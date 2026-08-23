begin;

create table if not exists public.bos_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  category text not null default 'operations' check (category in ('operations','project','schedule','finance','workforce','compliance','communication','system')),
  severity text not null default 'info' check (severity in ('info','success','warning','critical')),
  title text not null check (char_length(title) between 1 and 160),
  message text not null default '' check (char_length(message) <= 2000),
  entity_type text,
  entity_id uuid,
  linked_href text check (linked_href is null or linked_href like '/%'),
  source_module text not null default 'system',
  source_key text,
  requested_channels text[] not null default array['in_app']::text[],
  delivery_state text not null default 'ready' check (delivery_state in ('pending','ready','partially_delivered','delivered','failed','cancelled')),
  in_app_status text not null default 'ready' check (in_app_status in ('ready','read','archived')),
  push_status text not null default 'not_requested' check (push_status in ('not_requested','pending','accepted','delivered','failed','suppressed')),
  email_status text not null default 'not_requested' check (email_status in ('not_requested','pending','accepted','delivered','failed','suppressed')),
  delivery_metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bos_notifications_requested_channels_check check (requested_channels <@ array['in_app','push','email']::text[])
);

create unique index if not exists bos_notifications_source_key_unique
  on public.bos_notifications (company_id, recipient_user_id, source_key)
  where source_key is not null;
create index if not exists bos_notifications_recipient_created_idx
  on public.bos_notifications (company_id, recipient_user_id, created_at desc);
create index if not exists bos_notifications_recipient_unread_idx
  on public.bos_notifications (company_id, recipient_user_id, created_at desc)
  where read_at is null and archived_at is null;
create index if not exists bos_notifications_entity_idx
  on public.bos_notifications (company_id, entity_type, entity_id)
  where entity_id is not null;

alter table public.bos_notifications enable row level security;

drop policy if exists "bos notifications recipient select" on public.bos_notifications;
create policy "bos notifications recipient select"
  on public.bos_notifications for select to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and public.is_company_member(company_id)
  );

drop policy if exists "bos notifications recipient update" on public.bos_notifications;
create policy "bos notifications recipient update"
  on public.bos_notifications for update to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and public.is_company_member(company_id)
  )
  with check (
    recipient_user_id = (select auth.uid())
    and public.is_company_member(company_id)
  );

drop policy if exists "bos notifications authorized insert" on public.bos_notifications;
create policy "bos notifications authorized insert"
  on public.bos_notifications for insert to authenticated
  with check (
    public.is_company_member(company_id)
    and exists (
      select 1 from public.company_memberships recipient
      where recipient.company_id = bos_notifications.company_id
        and recipient.user_id = bos_notifications.recipient_user_id
        and recipient.status = 'active'
    )
    and (
      recipient_user_id = (select auth.uid())
      or public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','office_manager']::text[])
    )
  );

grant select, insert, update on public.bos_notifications to authenticated;
revoke delete on public.bos_notifications from authenticated;
revoke all on public.bos_notifications from anon;

create or replace function public.set_bos_notification_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if new.archived_at is not null then
    new.in_app_status := 'archived';
  elsif new.read_at is not null then
    new.in_app_status := 'read';
  else
    new.in_app_status := 'ready';
  end if;
  return new;
end;
$$;

revoke all on function public.set_bos_notification_updated_at() from public, anon, authenticated;

drop trigger if exists set_bos_notification_updated_at on public.bos_notifications;
create trigger set_bos_notification_updated_at
before update on public.bos_notifications
for each row execute function public.set_bos_notification_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bos_notifications'
  ) then
    alter publication supabase_realtime add table public.bos_notifications;
  end if;
end;
$$;

insert into public.bos_notifications (
  company_id, recipient_user_id, category, severity, title, message,
  linked_href, source_module, source_key, requested_channels,
  delivery_state, in_app_status, push_status, created_at
)
select
  reminder.company_id,
  reminder.user_id,
  'system',
  'info',
  reminder.title,
  reminder.message,
  reminder.linked_href,
  'orion_reminders',
  'orion-reminder:' || reminder.id::text,
  case when reminder.delivered_at is null then array['in_app']::text[] else array['in_app','push']::text[] end,
  case when reminder.delivered_at is null then 'ready' else 'delivered' end,
  'ready',
  case when reminder.delivered_at is null then 'not_requested' else 'delivered' end,
  reminder.created_at
from public.orion_reminders reminder
where reminder.cancelled_at is null
on conflict (company_id, recipient_user_id, source_key) where source_key is not null do nothing;

create or replace function public.notify_project_manager_of_trade_partner_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_manager_id uuid;
  v_project_name text;
  v_trade_name text;
begin
  if new.sender_type <> 'trade_partner' then return new; end if;

  select p.created_by, p.name, tpa.trade_name
    into v_manager_id, v_project_name, v_trade_name
  from public.projects p
  left join public.trade_partner_assignments tpa
    on tpa.company_id = new.company_id
   and tpa.project_id = new.project_id
   and tpa.vendor_id = new.vendor_id
   and tpa.assignment_status = 'active'
  where p.id = new.project_id and p.company_id = new.company_id
  order by tpa.created_at desc nulls last
  limit 1;

  if v_manager_id is null or not exists (
    select 1 from public.company_memberships cm
    where cm.company_id = new.company_id and cm.user_id = v_manager_id and cm.status = 'active'
  ) then return new; end if;

  insert into public.orion_reminders (company_id, user_id, title, message, due_at, event_title, linked_href)
  values (
    new.company_id, v_manager_id, 'New trade partner message',
    coalesce(v_trade_name, 'Trade partner') || ' replied on ' || coalesce(v_project_name, 'your project') || ': ' || left(new.body, 240),
    now() + interval '2 seconds', 'Trade partner reply',
    '/projects/' || new.project_id::text || '?tab=subcontractors'
  );

  insert into public.bos_notifications (
    company_id, recipient_user_id, actor_user_id, category, severity, title, message,
    entity_type, entity_id, linked_href, source_module, source_key, requested_channels,
    delivery_state, push_status
  ) values (
    new.company_id, v_manager_id, new.sender_user_id, 'communication', 'info',
    'New trade partner message',
    coalesce(v_trade_name, 'Trade partner') || ' replied on ' || coalesce(v_project_name, 'your project') || ': ' || left(new.body, 240),
    'project', new.project_id,
    '/projects/' || new.project_id::text || '?tab=subcontractors',
    'trade_partner_messages', 'trade-partner-message:' || new.id::text,
    array['in_app','push']::text[], 'ready', 'pending'
  ) on conflict (company_id, recipient_user_id, source_key) where source_key is not null do nothing;

  return new;
end;
$$;

revoke all on function public.notify_project_manager_of_trade_partner_message() from public, anon, authenticated;

commit;

begin;

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
    where cm.company_id = new.company_id
      and cm.user_id = v_manager_id
      and cm.status = 'active'
  ) then return new; end if;

  insert into public.orion_reminders (company_id, user_id, title, message, due_at, event_title, linked_href)
  values (
    new.company_id,
    v_manager_id,
    'New trade partner message',
    coalesce(v_trade_name, 'Trade partner') || ' replied on ' || coalesce(v_project_name, 'your project') || ': ' || left(new.body, 240),
    now() + interval '2 seconds',
    'Trade partner reply',
    '/projects/' || new.project_id::text || '?tab=subcontractors'
  );

  return new;
end;
$$;

revoke all on function public.notify_project_manager_of_trade_partner_message() from public;
revoke all on function public.notify_project_manager_of_trade_partner_message() from anon;
revoke all on function public.notify_project_manager_of_trade_partner_message() from authenticated;

drop trigger if exists trade_partner_message_manager_notification on public.trade_partner_messages;
create trigger trade_partner_message_manager_notification
after insert on public.trade_partner_messages
for each row execute function public.notify_project_manager_of_trade_partner_message();

commit;

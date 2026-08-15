create table if not exists public.orion_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orion_push_subscriptions_user_idx
  on public.orion_push_subscriptions (user_id, company_id);

create table if not exists public.orion_reminders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null default '',
  due_at timestamptz not null,
  event_title text,
  event_starts_at timestamptz,
  linked_href text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  delivered_at timestamptz,
  delivery_attempts integer not null default 0,
  last_delivery_error text
);

create index if not exists orion_reminders_due_idx
  on public.orion_reminders (due_at)
  where cancelled_at is null and delivered_at is null;

alter table public.orion_push_subscriptions enable row level security;
alter table public.orion_reminders enable row level security;

drop policy if exists "orion push subscriptions own rows" on public.orion_push_subscriptions;
create policy "orion push subscriptions own rows"
  on public.orion_push_subscriptions
  for all
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.company_members cm
      where cm.company_id = orion_push_subscriptions.company_id
        and cm.user_id = auth.uid()
        and coalesce(cm.is_active, true) = true
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.company_members cm
      where cm.company_id = orion_push_subscriptions.company_id
        and cm.user_id = auth.uid()
        and coalesce(cm.is_active, true) = true
    )
  );

drop policy if exists "orion reminders own rows" on public.orion_reminders;
create policy "orion reminders own rows"
  on public.orion_reminders
  for all
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.company_members cm
      where cm.company_id = orion_reminders.company_id
        and cm.user_id = auth.uid()
        and coalesce(cm.is_active, true) = true
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.company_members cm
      where cm.company_id = orion_reminders.company_id
        and cm.user_id = auth.uid()
        and coalesce(cm.is_active, true) = true
    )
  );

grant select, insert, update, delete on public.orion_push_subscriptions to authenticated;
grant select, insert, update, delete on public.orion_reminders to authenticated;

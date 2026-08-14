begin;

create table if not exists public.workforce_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_profile_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.workforce_events
  drop constraint if exists workforce_events_actor_profile_company_fkey,
  add constraint workforce_events_actor_profile_company_fkey
    foreign key (actor_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create index if not exists idx_workforce_events_company_occurred_at
  on public.workforce_events(company_id, occurred_at desc);

create index if not exists idx_workforce_events_company_entity
  on public.workforce_events(company_id, entity_type, entity_id);

create index if not exists idx_workforce_events_company_event_type
  on public.workforce_events(company_id, event_type);

alter table public.workforce_events enable row level security;

drop policy if exists workforce_events_select on public.workforce_events;
drop policy if exists workforce_events_insert on public.workforce_events;

create policy workforce_events_select
on public.workforce_events
for select
to authenticated
using (
  public.is_company_member(workforce_events.company_id)
);

create policy workforce_events_insert
on public.workforce_events
for insert
to authenticated
with check (
  public.has_company_role(
    workforce_events.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (workforce_events.actor_profile_id is null or workforce_events.actor_profile_id = auth.uid())
);

commit;

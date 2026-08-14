create table if not exists public.estimate_home_solicitation_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  actor_type text not null default 'system',
  actor_profile_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint estimate_home_solicitation_event_type_check check (event_type in (
    'profile_checked','notice_prepared','notice_delivered','oral_disclosure_confirmed',
    'contract_signed','cancellation_received','work_hold_created','work_hold_released'
  )),
  constraint estimate_home_solicitation_actor_type_check check (actor_type in ('system','customer','company_user'))
);

create index if not exists estimate_home_solicitation_events_lookup_idx
  on public.estimate_home_solicitation_events(company_id, estimate_id, occurred_at desc);

alter table public.estimate_home_solicitation_events enable row level security;

create policy "estimate_home_solicitation_events_active_company_members_read"
on public.estimate_home_solicitation_events
for select
to authenticated
using (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = estimate_home_solicitation_events.company_id
    and cm.user_id = auth.uid() and cm.status = 'active'
));

comment on table public.estimate_home_solicitation_events is
  'Append-only evidence trail for Ohio home-solicitation compliance actions and cancellation/work-hold lifecycle.';

begin;

create table if not exists public.workforce_orion_recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fingerprint text not null,
  recommendation_identity text not null,
  recommendation_type text not null,
  title text not null,
  reason text not null,
  priority text not null,
  expected_impact text not null,
  confidence numeric(4,3) not null,
  status text not null default 'open',
  affected_crew_id uuid null,
  affected_employee_id uuid null,
  affected_project_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  accepted_at timestamptz null,
  dismissed_at timestamptz null,
  completed_at timestamptz null,
  expired_at timestamptz null,
  actor_profile_id uuid null,
  outcome_status text null,
  outcome_notes text null,

  constraint workforce_orion_recommendations_fingerprint_not_blank_check check (btrim(fingerprint) <> ''),
  constraint workforce_orion_recommendations_identity_not_blank_check check (btrim(recommendation_identity) <> ''),
  constraint workforce_orion_recommendations_type_not_blank_check check (btrim(recommendation_type) <> ''),
  constraint workforce_orion_recommendations_title_not_blank_check check (btrim(title) <> ''),
  constraint workforce_orion_recommendations_reason_not_blank_check check (btrim(reason) <> ''),
  constraint workforce_orion_recommendations_priority_check check (priority in ('critical', 'high', 'medium', 'low')),
  constraint workforce_orion_recommendations_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint workforce_orion_recommendations_status_check check (status in ('open', 'acknowledged', 'accepted', 'dismissed', 'completed', 'expired')),
  constraint workforce_orion_recommendations_outcome_status_check check (
    outcome_status is null or outcome_status in ('pending', 'successful', 'partial', 'unsuccessful', 'unknown')
  )
);

create table if not exists public.workforce_orion_recommendation_history (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.workforce_orion_recommendations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  action text not null,
  from_status text null,
  to_status text null,
  actor_profile_id uuid null,
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  acted_at timestamptz not null default now(),

  constraint workforce_orion_recommendation_history_action_not_blank_check check (btrim(action) <> ''),
  constraint workforce_orion_recommendation_history_status_check check (
    (from_status is null or from_status in ('open', 'acknowledged', 'accepted', 'dismissed', 'completed', 'expired'))
    and (to_status is null or to_status in ('open', 'acknowledged', 'accepted', 'dismissed', 'completed', 'expired'))
  )
);

create table if not exists public.workforce_orion_recommendation_outcomes (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.workforce_orion_recommendations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  outcome_status text not null,
  notes text null,
  metrics jsonb not null default '{}'::jsonb,
  actor_profile_id uuid null,
  recorded_at timestamptz not null default now(),

  constraint workforce_orion_recommendation_outcomes_status_check check (
    outcome_status in ('pending', 'successful', 'partial', 'unsuccessful', 'unknown')
  )
);

create table if not exists public.workforce_orion_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  score_id text not null,
  score_label text not null,
  score_value integer not null,
  confidence numeric(4,3) not null,
  explanation text not null,
  recommended_action text not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint workforce_orion_score_snapshots_score_id_not_blank_check check (btrim(score_id) <> ''),
  constraint workforce_orion_score_snapshots_score_label_not_blank_check check (btrim(score_label) <> ''),
  constraint workforce_orion_score_snapshots_score_value_check check (score_value >= 0 and score_value <= 100),
  constraint workforce_orion_score_snapshots_confidence_check check (confidence >= 0 and confidence <= 1)
);

create table if not exists public.workforce_orion_timeline_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_fingerprint text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  title text not null,
  detail text not null,
  severity text not null,
  crew_id uuid null,
  employee_id uuid null,
  project_id uuid null,
  assignment_id uuid null,
  actor_profile_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'orion_workforce_evaluator',
  created_at timestamptz not null default now(),

  constraint workforce_orion_timeline_events_fingerprint_not_blank_check check (btrim(event_fingerprint) <> ''),
  constraint workforce_orion_timeline_events_event_type_not_blank_check check (btrim(event_type) <> ''),
  constraint workforce_orion_timeline_events_title_not_blank_check check (btrim(title) <> ''),
  constraint workforce_orion_timeline_events_detail_not_blank_check check (btrim(detail) <> ''),
  constraint workforce_orion_timeline_events_severity_check check (severity in ('critical', 'high', 'medium', 'low')),
  constraint workforce_orion_timeline_events_source_not_blank_check check (btrim(source) <> '')
);

alter table public.workforce_orion_recommendations
  drop constraint if exists workforce_orion_recommendations_crew_company_fkey,
  add constraint workforce_orion_recommendations_crew_company_fkey
    foreign key (affected_crew_id, company_id)
    references public.crews(id, company_id)
    on delete set null;

alter table public.workforce_orion_recommendations
  drop constraint if exists workforce_orion_recommendations_employee_company_fkey,
  add constraint workforce_orion_recommendations_employee_company_fkey
    foreign key (affected_employee_id, company_id)
    references public.employees(id, company_id)
    on delete set null;

alter table public.workforce_orion_recommendations
  drop constraint if exists workforce_orion_recommendations_project_company_fkey,
  add constraint workforce_orion_recommendations_project_company_fkey
    foreign key (affected_project_id, company_id)
    references public.projects(id, company_id)
    on delete set null;

alter table public.workforce_orion_recommendations
  drop constraint if exists workforce_orion_recommendations_actor_company_fkey,
  add constraint workforce_orion_recommendations_actor_company_fkey
    foreign key (actor_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.workforce_orion_recommendation_history
  drop constraint if exists workforce_orion_recommendation_history_actor_company_fkey,
  add constraint workforce_orion_recommendation_history_actor_company_fkey
    foreign key (actor_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.workforce_orion_recommendation_outcomes
  drop constraint if exists workforce_orion_recommendation_outcomes_actor_company_fkey,
  add constraint workforce_orion_recommendation_outcomes_actor_company_fkey
    foreign key (actor_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.workforce_orion_timeline_events
  drop constraint if exists workforce_orion_timeline_events_crew_company_fkey,
  add constraint workforce_orion_timeline_events_crew_company_fkey
    foreign key (crew_id, company_id)
    references public.crews(id, company_id)
    on delete set null;

alter table public.workforce_orion_timeline_events
  drop constraint if exists workforce_orion_timeline_events_employee_company_fkey,
  add constraint workforce_orion_timeline_events_employee_company_fkey
    foreign key (employee_id, company_id)
    references public.employees(id, company_id)
    on delete set null;

alter table public.workforce_orion_timeline_events
  drop constraint if exists workforce_orion_timeline_events_project_company_fkey,
  add constraint workforce_orion_timeline_events_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete set null;

alter table public.workforce_orion_timeline_events
  drop constraint if exists workforce_orion_timeline_events_actor_company_fkey,
  add constraint workforce_orion_timeline_events_actor_company_fkey
    foreign key (actor_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create index if not exists idx_workforce_orion_recommendations_company_created_at
  on public.workforce_orion_recommendations(company_id, created_at desc);

create index if not exists idx_workforce_orion_recommendations_company_status
  on public.workforce_orion_recommendations(company_id, status, created_at desc);

create index if not exists idx_workforce_orion_recommendations_company_fingerprint
  on public.workforce_orion_recommendations(company_id, fingerprint);

create unique index if not exists idx_workforce_orion_recommendations_company_active_fingerprint_unique
  on public.workforce_orion_recommendations(company_id, fingerprint)
  where status in ('open', 'acknowledged', 'accepted');

create index if not exists idx_workforce_orion_recommendation_history_company_recommendation
  on public.workforce_orion_recommendation_history(company_id, recommendation_id, acted_at desc);

create index if not exists idx_workforce_orion_recommendation_outcomes_company_recommendation
  on public.workforce_orion_recommendation_outcomes(company_id, recommendation_id, recorded_at desc);

create index if not exists idx_workforce_orion_score_snapshots_company_generated_at
  on public.workforce_orion_score_snapshots(company_id, generated_at desc);

create index if not exists idx_workforce_orion_score_snapshots_company_score_id
  on public.workforce_orion_score_snapshots(company_id, score_id, generated_at desc);

create index if not exists idx_workforce_orion_timeline_events_company_occurred_at
  on public.workforce_orion_timeline_events(company_id, occurred_at desc);

create index if not exists idx_workforce_orion_timeline_events_company_event_type
  on public.workforce_orion_timeline_events(company_id, event_type, occurred_at desc);

create index if not exists idx_workforce_orion_timeline_events_company_fingerprint
  on public.workforce_orion_timeline_events(company_id, event_fingerprint, occurred_at desc);

alter table public.workforce_orion_recommendations enable row level security;
alter table public.workforce_orion_recommendation_history enable row level security;
alter table public.workforce_orion_recommendation_outcomes enable row level security;
alter table public.workforce_orion_score_snapshots enable row level security;
alter table public.workforce_orion_timeline_events enable row level security;

drop policy if exists workforce_orion_recommendations_select on public.workforce_orion_recommendations;
drop policy if exists workforce_orion_recommendations_insert on public.workforce_orion_recommendations;
drop policy if exists workforce_orion_recommendations_update on public.workforce_orion_recommendations;

create policy workforce_orion_recommendations_select
on public.workforce_orion_recommendations
for select
to authenticated
using (
  public.is_company_member(workforce_orion_recommendations.company_id)
);

create policy workforce_orion_recommendations_insert
on public.workforce_orion_recommendations
for insert
to authenticated
with check (
  public.has_company_role(
    workforce_orion_recommendations.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (workforce_orion_recommendations.actor_profile_id is null or workforce_orion_recommendations.actor_profile_id = auth.uid())
);

create policy workforce_orion_recommendations_update
on public.workforce_orion_recommendations
for update
to authenticated
using (
  public.has_company_role(
    workforce_orion_recommendations.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
)
with check (
  public.has_company_role(
    workforce_orion_recommendations.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (workforce_orion_recommendations.actor_profile_id is null or workforce_orion_recommendations.actor_profile_id = auth.uid())
);

drop policy if exists workforce_orion_recommendation_history_select on public.workforce_orion_recommendation_history;
drop policy if exists workforce_orion_recommendation_history_insert on public.workforce_orion_recommendation_history;

create policy workforce_orion_recommendation_history_select
on public.workforce_orion_recommendation_history
for select
to authenticated
using (
  public.is_company_member(workforce_orion_recommendation_history.company_id)
);

create policy workforce_orion_recommendation_history_insert
on public.workforce_orion_recommendation_history
for insert
to authenticated
with check (
  public.has_company_role(
    workforce_orion_recommendation_history.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (workforce_orion_recommendation_history.actor_profile_id is null or workforce_orion_recommendation_history.actor_profile_id = auth.uid())
);

drop policy if exists workforce_orion_recommendation_outcomes_select on public.workforce_orion_recommendation_outcomes;
drop policy if exists workforce_orion_recommendation_outcomes_insert on public.workforce_orion_recommendation_outcomes;

create policy workforce_orion_recommendation_outcomes_select
on public.workforce_orion_recommendation_outcomes
for select
to authenticated
using (
  public.is_company_member(workforce_orion_recommendation_outcomes.company_id)
);

create policy workforce_orion_recommendation_outcomes_insert
on public.workforce_orion_recommendation_outcomes
for insert
to authenticated
with check (
  public.has_company_role(
    workforce_orion_recommendation_outcomes.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (workforce_orion_recommendation_outcomes.actor_profile_id is null or workforce_orion_recommendation_outcomes.actor_profile_id = auth.uid())
);

drop policy if exists workforce_orion_score_snapshots_select on public.workforce_orion_score_snapshots;
drop policy if exists workforce_orion_score_snapshots_insert on public.workforce_orion_score_snapshots;

create policy workforce_orion_score_snapshots_select
on public.workforce_orion_score_snapshots
for select
to authenticated
using (
  public.is_company_member(workforce_orion_score_snapshots.company_id)
);

create policy workforce_orion_score_snapshots_insert
on public.workforce_orion_score_snapshots
for insert
to authenticated
with check (
  public.has_company_role(
    workforce_orion_score_snapshots.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
);

drop policy if exists workforce_orion_timeline_events_select on public.workforce_orion_timeline_events;
drop policy if exists workforce_orion_timeline_events_insert on public.workforce_orion_timeline_events;

create policy workforce_orion_timeline_events_select
on public.workforce_orion_timeline_events
for select
to authenticated
using (
  public.is_company_member(workforce_orion_timeline_events.company_id)
);

create policy workforce_orion_timeline_events_insert
on public.workforce_orion_timeline_events
for insert
to authenticated
with check (
  public.has_company_role(
    workforce_orion_timeline_events.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (workforce_orion_timeline_events.actor_profile_id is null or workforce_orion_timeline_events.actor_profile_id = auth.uid())
);

do $$
declare
  v_updated_at_fn regprocedure;
begin
  select p.oid::regprocedure
    into v_updated_at_fn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_attribute a
    on a.attrelid = c.oid
   and a.attname = 'updated_at'
  where n.nspname = 'public'
    and c.relname in (
      'companies',
      'customers',
      'profiles',
      'projects',
      'estimates',
      'invoices',
      'project_phases',
      'tasks',
      'employees',
      'crews',
      'crew_memberships',
      'workforce_assignments'
    )
    and not t.tgisinternal
  order by c.relname, t.tgname
  limit 1;

  if v_updated_at_fn is null then
    raise exception 'No updated_at trigger function found to reuse.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'workforce_orion_recommendations'
      and t.tgname = 'trg_workforce_orion_recommendations_set_updated_at'
  ) then
    execute format(
      'create trigger trg_workforce_orion_recommendations_set_updated_at before update on public.workforce_orion_recommendations for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;

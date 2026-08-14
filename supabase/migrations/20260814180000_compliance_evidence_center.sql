begin;

create or replace view public.compliance_evidence_center
with (security_invoker = true)
as
select
  'home_solicitation'::text as evidence_domain,
  e.id as evidence_id,
  e.company_id,
  est.project_id,
  e.estimate_id,
  null::uuid as change_order_id,
  e.event_type as evidence_type,
  null::text as decision,
  null::text as blocker_code,
  e.actor_profile_id,
  e.actor_type as source,
  e.occurred_at,
  e.created_at,
  e.metadata
from public.estimate_home_solicitation_events e
join public.estimates est
  on est.id = e.estimate_id and est.company_id = e.company_id

union all

select
  'operational_work_start'::text as evidence_domain,
  a.id as evidence_id,
  a.company_id,
  a.project_id,
  a.estimate_id,
  a.change_order_id,
  a.action_type as evidence_type,
  a.decision,
  a.blocker_code,
  a.actor_profile_id,
  a.source,
  a.created_at as occurred_at,
  a.created_at,
  a.metadata
from public.operational_work_start_authorizations a;

comment on view public.compliance_evidence_center is
  'Read-only unified compliance evidence timeline. Source records remain authoritative and append-only.';

grant select on public.compliance_evidence_center to authenticated;

create or replace function public.get_compliance_evidence_center(
  p_company_id uuid,
  p_project_id uuid default null,
  p_estimate_id uuid default null,
  p_limit integer default 100
)
returns table (
  evidence_domain text,
  evidence_id uuid,
  company_id uuid,
  project_id uuid,
  estimate_id uuid,
  change_order_id uuid,
  evidence_type text,
  decision text,
  blocker_code text,
  actor_profile_id uuid,
  source text,
  occurred_at timestamptz,
  created_at timestamptz,
  metadata jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    c.evidence_domain,
    c.evidence_id,
    c.company_id,
    c.project_id,
    c.estimate_id,
    c.change_order_id,
    c.evidence_type,
    c.decision,
    c.blocker_code,
    c.actor_profile_id,
    c.source,
    c.occurred_at,
    c.created_at,
    c.metadata
  from public.compliance_evidence_center c
  where c.company_id = p_company_id
    and (p_project_id is null or c.project_id = p_project_id)
    and (p_estimate_id is null or c.estimate_id = p_estimate_id)
  order by c.occurred_at desc, c.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

grant execute on function public.get_compliance_evidence_center(uuid, uuid, uuid, integer) to authenticated;

commit;

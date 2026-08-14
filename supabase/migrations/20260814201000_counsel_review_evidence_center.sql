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
from public.operational_work_start_authorizations a

union all

select
  'counsel_review'::text as evidence_domain,
  r.id as evidence_id,
  r.company_id,
  est.project_id,
  r.estimate_id,
  null::uuid as change_order_id,
  r.disposition as evidence_type,
  null::text as decision,
  null::text as blocker_code,
  null::uuid as actor_profile_id,
  r.reviewer_capacity as source,
  r.reviewed_at as occurred_at,
  r.created_at,
  r.metadata || jsonb_build_object(
    'jurisdictionPackId', r.jurisdiction_pack_id,
    'rulesetId', r.ruleset_id,
    'rulesetVersion', r.ruleset_version,
    'reviewScope', r.review_scope,
    'reviewerName', r.reviewer_name,
    'reviewerOrganization', r.reviewer_organization,
    'recordedByMembershipId', r.recorded_by_membership_id,
    'recordedByRole', r.recorded_by_role
  ) as metadata
from public.compliance_counsel_reviews r
join public.estimates est
  on est.id = r.estimate_id and est.company_id = r.company_id;

comment on view public.compliance_evidence_center is
  'Read-only unified compliance evidence timeline including counsel-review evidence. Source records remain authoritative and append-only.';

grant select on public.compliance_evidence_center to authenticated;

commit;

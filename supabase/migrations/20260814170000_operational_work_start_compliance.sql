begin;

create table if not exists public.operational_work_start_authorizations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  change_order_id uuid null,
  action_type text not null,
  decision text not null,
  blocker_code text null,
  blocker_message text null,
  source text not null default 'operational_work_start',
  actor_profile_id uuid null references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint operational_work_start_action_check
    check (action_type in ('project_work_start','change_order_work_start')),
  constraint operational_work_start_decision_check
    check (decision in ('ALLOWED','BLOCKED')),
  constraint operational_work_start_change_order_company_fkey
    foreign key (change_order_id, company_id)
    references public.change_orders(id, company_id)
    on delete cascade
);

create index if not exists operational_work_start_authorizations_lookup_idx
  on public.operational_work_start_authorizations(company_id, estimate_id, created_at desc);
create index if not exists operational_work_start_authorizations_change_order_idx
  on public.operational_work_start_authorizations(company_id, change_order_id, created_at desc);

alter table public.operational_work_start_authorizations enable row level security;

create policy operational_work_start_company_members_read
on public.operational_work_start_authorizations
for select
to authenticated
using (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = operational_work_start_authorizations.company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
));

create policy operational_work_start_company_members_insert
on public.operational_work_start_authorizations
for insert
to authenticated
with check (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = operational_work_start_authorizations.company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
));

-- No UPDATE or DELETE policies: operational authorization evidence is append-only.

create or replace function public.assert_operational_estimate_work_may_begin(
  p_company_id uuid,
  p_estimate_id uuid
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_estimate_company uuid;
begin
  select e.company_id into v_estimate_company
  from public.estimates e
  where e.id = p_estimate_id;

  if not found or v_estimate_company <> p_company_id then
    raise exception 'GOVERNING_ESTIMATE_NOT_FOUND';
  end if;

  -- Reuse the Phase 2 cancellation-period/cancellation guard as the contract-level start boundary.
  perform public.assert_estimate_work_may_begin(p_company_id, p_estimate_id);
end;
$$;

create or replace function public.assert_operational_change_order_work_may_begin(
  p_company_id uuid,
  p_change_order_id uuid
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_estimate_id uuid;
begin
  select co.estimate_id into v_estimate_id
  from public.change_orders co
  where co.id = p_change_order_id
    and co.company_id = p_company_id;

  if not found then
    raise exception 'CHANGE_ORDER_NOT_FOUND';
  end if;

  -- A change-order start cannot be authorized without identifying the governing contract.
  if v_estimate_id is null then
    raise exception 'GOVERNING_ESTIMATE_REQUIRED';
  end if;

  -- Contract-level Phase 2 hold first, then the Phase 5 excess-cost work-start gate.
  perform public.assert_estimate_work_may_begin(p_company_id, v_estimate_id);
  perform public.assert_change_order_excess_cost_work_may_start(p_change_order_id);
end;
$$;

create or replace function public.get_operational_work_start_decision(
  p_company_id uuid,
  p_estimate_id uuid,
  p_change_order_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid;
  v_message text;
  v_code text;
begin
  select e.project_id into v_project_id
  from public.estimates e
  where e.id = p_estimate_id and e.company_id = p_company_id;

  if not found then
    return jsonb_build_object(
      'decision','BLOCKED',
      'blockerCode','GOVERNING_ESTIMATE_NOT_FOUND',
      'blockerMessage','A governing contract estimate is required before work can begin.'
    );
  end if;

  begin
    if p_change_order_id is null then
      perform public.assert_operational_estimate_work_may_begin(p_company_id, p_estimate_id);
    else
      perform public.assert_operational_change_order_work_may_begin(p_company_id, p_change_order_id);
    end if;
  exception when others then
    get stacked diagnostics v_message = message_text;
    v_code := case
      when v_message like '%HOME_SOLICITATION_CANCELLATION_HOLD%' then 'HOME_SOLICITATION_CANCELLATION_HOLD'
      when v_message like '%CONTRACT_CANCELLED%' then 'CONTRACT_CANCELLED'
      when v_message like '%GOVERNING_ESTIMATE_REQUIRED%' then 'GOVERNING_ESTIMATE_REQUIRED'
      when v_message like '%Change-order work start blocked by compliance:%' then 'CHANGE_ORDER_EXCESS_COST_BLOCKED'
      else 'COMPLIANCE_REVIEW_REQUIRED'
    end;

    return jsonb_build_object(
      'decision','BLOCKED',
      'projectId',v_project_id,
      'estimateId',p_estimate_id,
      'changeOrderId',p_change_order_id,
      'blockerCode',v_code,
      'blockerMessage',v_message
    );
  end;

  return jsonb_build_object(
    'decision','ALLOWED',
    'projectId',v_project_id,
    'estimateId',p_estimate_id,
    'changeOrderId',p_change_order_id,
    'blockerCode',null,
    'blockerMessage',null
  );
end;
$$;

comment on function public.assert_operational_estimate_work_may_begin(uuid, uuid) is
  'Unified operational work-start boundary for work governed by an estimate/contract. Reuses existing compliance guards rather than duplicating legal rules.';
comment on function public.assert_operational_change_order_work_may_begin(uuid, uuid) is
  'Unified change-order work-start boundary. Requires a governing estimate, applies the contract-level start hold, then applies the excess-cost work-start gate.';
comment on table public.operational_work_start_authorizations is
  'Append-only evidence of operational work-start authorization decisions across UI, API, and Orion channels.';

commit;

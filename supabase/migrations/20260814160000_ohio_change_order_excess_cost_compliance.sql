begin;

create table if not exists public.change_order_excess_cost_compliance_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  change_order_id uuid not null,
  estimate_id uuid null,
  ruleset_id text not null default 'ohio-orc-4722-excess-costs',
  ruleset_version text not null default '2026-08-14.v1',
  jurisdiction text not null default 'OH',
  status text not null,
  applicable boolean null,
  qualifies_as_unforeseen_necessary boolean null,
  cumulative_qualifying_excess_amount numeric(14,2) not null default 0,
  estimate_method text null,
  estimate_provided_at timestamptz null,
  estimate_amount numeric(14,2) null,
  owner_approved boolean not null default false,
  owner_approved_at timestamptz null,
  owner_approval_method text null,
  evidence jsonb not null default '{}'::jsonb,
  evaluated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint change_order_excess_cost_eval_status_check
    check (status in ('COMPLIANT','ACTION_REQUIRED','REVIEW_REQUIRED')),
  constraint change_order_excess_cost_eval_method_check
    check (estimate_method is null or estimate_method in ('written','oral')),
  constraint change_order_excess_cost_owner_method_check
    check (owner_approval_method is null or owner_approval_method in ('signature','written','oral','portal','other')),
  constraint change_order_excess_cost_eval_amount_check
    check (cumulative_qualifying_excess_amount >= 0),
  constraint change_order_excess_cost_estimate_amount_check
    check (estimate_amount is null or estimate_amount >= 0),
  constraint change_order_excess_cost_change_order_company_fkey
    foreign key (change_order_id, company_id)
    references public.change_orders(id, company_id)
    on delete cascade
);

create index if not exists change_order_excess_cost_eval_lookup_idx
  on public.change_order_excess_cost_compliance_evaluations(company_id, change_order_id, created_at desc);

create index if not exists change_order_excess_cost_eval_estimate_idx
  on public.change_order_excess_cost_compliance_evaluations(company_id, estimate_id, created_at desc);

alter table public.change_order_excess_cost_compliance_evaluations enable row level security;

drop policy if exists change_order_excess_cost_eval_company_members_read
  on public.change_order_excess_cost_compliance_evaluations;
create policy change_order_excess_cost_eval_company_members_read
on public.change_order_excess_cost_compliance_evaluations
for select
to authenticated
using (exists (
  select 1
  from public.company_memberships cm
  where cm.company_id = change_order_excess_cost_compliance_evaluations.company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
));

drop policy if exists change_order_excess_cost_eval_company_members_insert
  on public.change_order_excess_cost_compliance_evaluations;
create policy change_order_excess_cost_eval_company_members_insert
on public.change_order_excess_cost_compliance_evaluations
for insert
to authenticated
with check (exists (
  select 1
  from public.company_memberships cm
  where cm.company_id = change_order_excess_cost_compliance_evaluations.company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
));

-- Intentionally no UPDATE or DELETE policy: compliance evidence is append-only.

create or replace function public.get_change_order_excess_cost_gate(p_change_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_co public.change_orders%rowtype;
  v_profile public.estimate_contract_compliance_profiles%rowtype;
  v_contract_applicable boolean;
  v_latest public.change_order_excess_cost_compliance_evaluations%rowtype;
  v_cumulative numeric(14,2) := 0;
  v_estimate_required boolean := false;
  v_estimate_satisfied boolean := false;
  v_owner_approval_required boolean := false;
  v_owner_approval_satisfied boolean := false;
  v_work_may_start boolean := true;
  v_charge_may_proceed boolean := true;
  v_status text := 'COMPLIANT';
  v_reason text := null;
begin
  select *
    into v_co
  from public.change_orders
  where id = p_change_order_id;

  if not found then
    return jsonb_build_object(
      'status', 'REVIEW_REQUIRED',
      'applicable', null,
      'workMayStart', false,
      'chargeMayProceed', false,
      'reason', 'Change order not found.'
    );
  end if;

  if v_co.estimate_id is null then
    return jsonb_build_object(
      'status', 'COMPLIANT',
      'applicable', false,
      'workMayStart', true,
      'chargeMayProceed', true,
      'reason', 'No contract estimate is linked; the Ohio contract compliance profile cannot be applied to this change order.'
    );
  end if;

  select *
    into v_profile
  from public.estimate_contract_compliance_profiles p
  where p.company_id = v_co.company_id
    and p.estimate_id = v_co.estimate_id
  order by p.updated_at desc
  limit 1;

  if not found or upper(coalesce(v_profile.property_state, '')) not in ('OH','OHIO') then
    return jsonb_build_object(
      'status', 'COMPLIANT',
      'applicable', false,
      'workMayStart', true,
      'chargeMayProceed', true,
      'reason', 'Ohio Chapter 4722 excess-cost gate is not applicable.'
    );
  end if;

  select e.applicable
    into v_contract_applicable
  from public.estimate_contract_compliance_evaluations e
  where e.company_id = v_co.company_id
    and e.estimate_id = v_co.estimate_id
  order by e.created_at desc
  limit 1;

  if v_contract_applicable is distinct from true then
    return jsonb_build_object(
      'status', case when v_contract_applicable is false then 'COMPLIANT' else 'REVIEW_REQUIRED' end,
      'applicable', v_contract_applicable,
      'workMayStart', v_contract_applicable is false,
      'chargeMayProceed', v_contract_applicable is false,
      'reason', case
        when v_contract_applicable is false then 'The linked contract evaluation is not covered by the Ohio home-construction rule.'
        else 'Resolve the linked Ohio contract compliance evaluation before excess-cost work or charging.'
      end
    );
  end if;

  if v_profile.pricing_type = 'cost_plus' then
    return jsonb_build_object(
      'status', 'COMPLIANT',
      'applicable', true,
      'exemptReason', 'cost_plus',
      'workMayStart', true,
      'chargeMayProceed', true,
      'reason', 'Cost-plus contract exception applies.'
    );
  end if;

  select *
    into v_latest
  from public.change_order_excess_cost_compliance_evaluations e
  where e.company_id = v_co.company_id
    and e.change_order_id = v_co.id
  order by e.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'status', 'REVIEW_REQUIRED',
      'applicable', true,
      'workMayStart', false,
      'chargeMayProceed', false,
      'reason', 'Classify this change order and capture excess-cost compliance evidence before work or charging proceeds.'
    );
  end if;

  if v_profile.excess_cost_method = 'firm_price_no_excess' then
    if coalesce(v_co.total_amount, 0) > 0 then
      return jsonb_build_object(
        'status', 'ACTION_REQUIRED',
        'applicable', true,
        'exemptReason', 'firm_price_no_excess',
        'workMayStart', false,
        'chargeMayProceed', false,
        'reason', 'The linked contract is configured as firm-price with no excess-cost charge.'
      );
    end if;

    return jsonb_build_object(
      'status', 'COMPLIANT',
      'applicable', true,
      'exemptReason', 'firm_price_no_excess',
      'workMayStart', true,
      'chargeMayProceed', true,
      'reason', 'No excess charge is being requested.'
    );
  end if;

  if v_latest.qualifies_as_unforeseen_necessary is null then
    return jsonb_build_object(
      'status', 'REVIEW_REQUIRED',
      'applicable', true,
      'workMayStart', false,
      'chargeMayProceed', false,
      'reason', 'Classify whether the change is reasonably unforeseen but necessary.'
    );
  end if;

  if v_latest.qualifies_as_unforeseen_necessary is false then
    return jsonb_build_object(
      'status', 'COMPLIANT',
      'applicable', true,
      'qualifiesAsUnforeseenNecessary', false,
      'workMayStart', true,
      'chargeMayProceed', true,
      'reason', 'This change is classified outside the statutory unforeseen-and-necessary excess-cost rule.'
    );
  end if;

  select coalesce(sum(co.total_amount), 0)
    into v_cumulative
  from public.change_orders co
  join lateral (
    select ev.qualifies_as_unforeseen_necessary
    from public.change_order_excess_cost_compliance_evaluations ev
    where ev.company_id = co.company_id
      and ev.change_order_id = co.id
    order by ev.created_at desc
    limit 1
  ) latest_ev on true
  where co.company_id = v_co.company_id
    and co.estimate_id = v_co.estimate_id
    and co.status <> 'void'
    and latest_ev.qualifies_as_unforeseen_necessary is true;

  v_estimate_required := v_cumulative > 5000;
  v_owner_approval_required := coalesce(v_co.total_amount, 0) > 0;

  if v_estimate_required then
    v_estimate_satisfied := v_profile.excess_cost_method in ('written','oral')
      and v_latest.estimate_method = v_profile.excess_cost_method
      and v_latest.estimate_provided_at is not null;
  else
    v_estimate_satisfied := true;
  end if;

  if v_owner_approval_required then
    v_owner_approval_satisfied := v_latest.owner_approved is true
      and v_latest.owner_approved_at is not null;
  else
    v_owner_approval_satisfied := true;
  end if;

  v_work_may_start := v_estimate_satisfied;
  v_charge_may_proceed := v_estimate_satisfied and v_owner_approval_satisfied;

  if not v_estimate_satisfied then
    v_status := 'ACTION_REQUIRED';
    v_reason := 'Provide the owner the contract-selected excess-cost estimate before related work starts.';
  elsif not v_owner_approval_satisfied then
    v_status := 'ACTION_REQUIRED';
    v_reason := 'Capture owner approval before charging the excess cost.';
  else
    v_status := 'COMPLIANT';
    v_reason := 'Required excess-cost estimate and owner-approval evidence are satisfied.';
  end if;

  return jsonb_build_object(
    'rulesetId', 'ohio-orc-4722-excess-costs',
    'rulesetVersion', '2026-08-14.v1',
    'jurisdiction', 'OH',
    'status', v_status,
    'applicable', true,
    'qualifiesAsUnforeseenNecessary', true,
    'cumulativeQualifyingExcessAmount', v_cumulative,
    'estimateNoticeRequired', v_estimate_required,
    'contractEstimateMethod', v_profile.excess_cost_method,
    'ownerApprovalRequiredBeforeCharge', v_owner_approval_required,
    'workMayStart', v_work_may_start,
    'chargeMayProceed', v_charge_may_proceed,
    'reason', v_reason
  );
end;
$$;

create or replace function public.assert_change_order_excess_cost_work_may_start(p_change_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_gate jsonb;
begin
  v_gate := public.get_change_order_excess_cost_gate(p_change_order_id);
  if coalesce((v_gate->>'workMayStart')::boolean, false) is not true then
    raise exception 'Change-order work start blocked by compliance: %', coalesce(v_gate->>'reason', 'Review required.');
  end if;
end;
$$;

create or replace function public.assert_change_order_excess_cost_charge_allowed(p_change_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_gate jsonb;
begin
  v_gate := public.get_change_order_excess_cost_gate(p_change_order_id);
  if coalesce((v_gate->>'chargeMayProceed')::boolean, false) is not true then
    raise exception 'Change-order charge blocked by compliance: %', coalesce(v_gate->>'reason', 'Review required.');
  end if;
end;
$$;

create or replace function public.trg_change_order_invoice_compliance_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.assert_change_order_excess_cost_charge_allowed(new.change_order_id);
  return new;
end;
$$;

drop trigger if exists trg_change_order_invoice_compliance on public.change_order_invoice_links;
create trigger trg_change_order_invoice_compliance
before insert or update of change_order_id, amount_applied on public.change_order_invoice_links
for each row execute function public.trg_change_order_invoice_compliance_fn();

create or replace function public.trg_change_order_invoiced_status_compliance_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'invoiced' and old.status is distinct from 'invoiced' then
    perform public.assert_change_order_excess_cost_charge_allowed(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_change_order_invoiced_status_compliance on public.change_orders;
create trigger trg_change_order_invoiced_status_compliance
before update of status on public.change_orders
for each row execute function public.trg_change_order_invoiced_status_compliance_fn();

comment on table public.change_order_excess_cost_compliance_evaluations is
  'Append-only evidence for Ohio ORC Chapter 4722 excess-cost estimate and owner-approval compliance.';
comment on function public.assert_change_order_excess_cost_work_may_start(uuid) is
  'Hard gate used before starting covered excess-cost work. ORC 4722.02(B) requires the contract-selected estimate once cumulative qualifying excess costs exceed $5,000.';
comment on function public.assert_change_order_excess_cost_charge_allowed(uuid) is
  'Hard gate used before charging a covered excess cost. ORC 4722.03 prohibits charging an excess cost the owner has not approved.';

commit;

begin;

-- Refine the Phase 5 gate so the firm-price/no-excess rule applies only after
-- a change is classified as a reasonably unforeseen but necessary excess cost.
-- The special $5,000 estimate notice depends on that classification, while
-- owner approval remains independently required before a covered excess charge.
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
begin
  select * into v_co
  from public.change_orders
  where id = p_change_order_id;

  if not found then
    return jsonb_build_object('status','REVIEW_REQUIRED','applicable',null,'workMayStart',false,'chargeMayProceed',false,'reason','Change order not found.');
  end if;

  if v_co.estimate_id is null then
    return jsonb_build_object(
      'status','COMPLIANT','applicable',false,'workMayStart',true,'chargeMayProceed',true,
      'reason','No contract estimate is linked; the Ohio contract compliance profile cannot be applied to this change order.'
    );
  end if;

  select * into v_profile
  from public.estimate_contract_compliance_profiles p
  where p.company_id = v_co.company_id
    and p.estimate_id = v_co.estimate_id
  order by p.updated_at desc
  limit 1;

  if not found or upper(coalesce(v_profile.property_state,'')) not in ('OH','OHIO') then
    return jsonb_build_object('status','COMPLIANT','applicable',false,'workMayStart',true,'chargeMayProceed',true,'reason','Ohio Chapter 4722 excess-cost gate is not applicable.');
  end if;

  select e.applicable into v_contract_applicable
  from public.estimate_contract_compliance_evaluations e
  where e.company_id = v_co.company_id
    and e.estimate_id = v_co.estimate_id
  order by e.created_at desc
  limit 1;

  if v_contract_applicable is distinct from true then
    return jsonb_build_object(
      'status',case when v_contract_applicable is false then 'COMPLIANT' else 'REVIEW_REQUIRED' end,
      'applicable',v_contract_applicable,
      'workMayStart',v_contract_applicable is false,
      'chargeMayProceed',v_contract_applicable is false,
      'reason',case when v_contract_applicable is false
        then 'The linked contract evaluation is not covered by the Ohio home-construction rule.'
        else 'Resolve the linked Ohio contract compliance evaluation before excess-cost work or charging.' end
    );
  end if;

  if v_profile.pricing_type = 'cost_plus' then
    return jsonb_build_object('status','COMPLIANT','applicable',true,'exemptReason','cost_plus','workMayStart',true,'chargeMayProceed',true,'reason','Cost-plus contract exception applies.');
  end if;

  select * into v_latest
  from public.change_order_excess_cost_compliance_evaluations e
  where e.company_id = v_co.company_id
    and e.change_order_id = v_co.id
  order by e.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'status','REVIEW_REQUIRED','applicable',true,'workMayStart',false,'chargeMayProceed',false,
      'reason','Classify this change order and capture excess-cost compliance evidence before work or charging proceeds.'
    );
  end if;

  if v_latest.qualifies_as_unforeseen_necessary is null then
    return jsonb_build_object(
      'status','REVIEW_REQUIRED','applicable',true,'workMayStart',false,'chargeMayProceed',false,
      'ownerApprovalRequiredBeforeCharge',coalesce(v_co.total_amount,0) > 0,
      'reason','Classify whether the change is reasonably unforeseen but necessary.'
    );
  end if;

  v_owner_approval_required := coalesce(v_co.total_amount,0) > 0;
  v_owner_approval_satisfied := not v_owner_approval_required or (
    v_latest.owner_approved is true
    and v_latest.owner_approved_at is not null
  );

  if v_latest.qualifies_as_unforeseen_necessary is false then
    return jsonb_build_object(
      'status',case when v_owner_approval_satisfied then 'COMPLIANT' else 'ACTION_REQUIRED' end,
      'applicable',true,
      'qualifiesAsUnforeseenNecessary',false,
      'estimateNoticeRequired',false,
      'ownerApprovalRequiredBeforeCharge',v_owner_approval_required,
      'workMayStart',true,
      'chargeMayProceed',v_owner_approval_satisfied,
      'reason',case when v_owner_approval_satisfied
        then 'No special excess-cost estimate notice is required for this classification, and owner approval for the charge is documented.'
        else 'No special excess-cost estimate notice is required for this classification, but owner approval is required before charging the excess cost.' end
    );
  end if;

  if v_profile.excess_cost_method = 'firm_price_no_excess' then
    if coalesce(v_co.total_amount,0) > 0 then
      return jsonb_build_object(
        'status','ACTION_REQUIRED','applicable',true,'qualifiesAsUnforeseenNecessary',true,
        'exemptReason','firm_price_no_excess','workMayStart',false,'chargeMayProceed',false,
        'reason','The linked contract is configured as firm-price with no qualifying excess-cost charge.'
      );
    end if;

    return jsonb_build_object(
      'status','COMPLIANT','applicable',true,'qualifiesAsUnforeseenNecessary',true,
      'exemptReason','firm_price_no_excess','workMayStart',true,'chargeMayProceed',true,
      'reason','No qualifying excess charge is being requested.'
    );
  end if;

  select coalesce(sum(co.total_amount),0) into v_cumulative
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
  v_estimate_satisfied := not v_estimate_required or (
    v_profile.excess_cost_method in ('written','oral')
    and v_latest.estimate_method = v_profile.excess_cost_method
    and v_latest.estimate_provided_at is not null
  );

  return jsonb_build_object(
    'rulesetId','ohio-orc-4722-excess-costs',
    'rulesetVersion','2026-08-14.v1',
    'jurisdiction','OH',
    'status',case when v_estimate_satisfied and v_owner_approval_satisfied then 'COMPLIANT' else 'ACTION_REQUIRED' end,
    'applicable',true,
    'qualifiesAsUnforeseenNecessary',true,
    'cumulativeQualifyingExcessAmount',v_cumulative,
    'estimateNoticeRequired',v_estimate_required,
    'contractEstimateMethod',v_profile.excess_cost_method,
    'ownerApprovalRequiredBeforeCharge',v_owner_approval_required,
    'workMayStart',v_estimate_satisfied,
    'chargeMayProceed',v_estimate_satisfied and v_owner_approval_satisfied,
    'reason',case
      when not v_estimate_satisfied then 'Provide the owner the contract-selected excess-cost estimate before related work starts.'
      when not v_owner_approval_satisfied then 'Capture owner approval before charging the excess cost.'
      else 'Required excess-cost estimate and owner-approval evidence are satisfied.'
    end
  );
end;
$$;

commit;

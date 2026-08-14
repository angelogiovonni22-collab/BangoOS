create or replace function public.calculate_estimate_deposit(p_company_id uuid, p_estimate_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requested numeric := 0;
  v_contract_amount numeric := 0;
  v_eval_status text;
  v_eval_applicable boolean;
  v_pricing_type text := 'unknown';
  v_special_order_amount numeric := 0;
  v_special_order_nonreturnable boolean := false;
  v_ordinary_limit numeric := 0;
  v_special_limit numeric := 0;
  v_maximum numeric := 0;
begin
  if p_company_id is null or p_estimate_id is null then
    raise exception 'Company id and estimate id are required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.company_id = p_company_id
  ) then
    raise exception 'Not authorized for company %', p_company_id;
  end if;

  select
    public.calculate_deposit_amount(e.deposit_type, e.deposit_value, e.total_amount),
    greatest(coalesce(e.total_amount, 0), 0)
  into v_requested, v_contract_amount
  from public.estimates e
  where e.company_id = p_company_id
    and e.id = p_estimate_id;

  if v_requested is null then
    raise exception 'Estimate % was not found for company %', p_estimate_id, p_company_id;
  end if;

  select ce.status, ce.applicable
    into v_eval_status, v_eval_applicable
  from public.estimate_contract_compliance_evaluations ce
  where ce.company_id = p_company_id
    and ce.estimate_id = p_estimate_id
    and ce.ruleset_id = 'OH_RESIDENTIAL_HOME_CONSTRUCTION'
  order by ce.created_at desc
  limit 1;

  -- No Ohio ruleset evaluation means the general estimate workflow remains unchanged unless the
  -- record has been classified as an Ohio compliance-controlled contract elsewhere.
  if v_eval_status is null or v_eval_applicable is false then
    return round(greatest(v_requested, 0), 2);
  end if;

  if v_eval_applicable is null or v_eval_status <> 'COMPLIANT' then
    raise exception 'B.O.S. contract compliance must be cleared before a controlled deposit invoice is created';
  end if;

  select cp.pricing_type, cp.special_order_amount, cp.special_order_nonreturnable
    into v_pricing_type, v_special_order_amount, v_special_order_nonreturnable
  from public.estimate_contract_compliance_profiles cp
  where cp.company_id = p_company_id
    and cp.estimate_id = p_estimate_id
  limit 1;

  if coalesce(v_pricing_type, 'unknown') = 'cost_plus' then
    return round(greatest(v_requested, 0), 2);
  end if;

  if coalesce(v_pricing_type, 'unknown') = 'unknown' then
    raise exception 'B.O.S. requires the contract pricing classification before a controlled deposit invoice is created';
  end if;

  v_ordinary_limit := round(v_contract_amount * 0.10, 2);
  if coalesce(v_special_order_nonreturnable, false) then
    v_special_limit := round(greatest(coalesce(v_special_order_amount, 0), 0) * 0.75, 2);
  end if;
  v_maximum := greatest(v_ordinary_limit, v_special_limit);

  return round(least(greatest(v_requested, 0), v_maximum), 2);
end;
$$;

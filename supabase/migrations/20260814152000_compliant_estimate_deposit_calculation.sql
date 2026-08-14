create or replace function public.calculate_estimate_deposit(p_company_id uuid, p_estimate_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requested numeric := 0;
  v_contract_amount numeric := 0;
  v_property_state text := '';
  v_eval_status text;
  v_eval_applicable boolean;
  v_eval_created_at timestamptz;
  v_profile_updated_at timestamptz;
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
    greatest(coalesce(e.total_amount, 0), 0),
    upper(trim(coalesce(cp.property_state, c.state, ''))),
    cp.pricing_type,
    cp.special_order_amount,
    cp.special_order_nonreturnable,
    cp.updated_at
  into
    v_requested,
    v_contract_amount,
    v_property_state,
    v_pricing_type,
    v_special_order_amount,
    v_special_order_nonreturnable,
    v_profile_updated_at
  from public.estimates e
  left join public.estimate_contract_compliance_profiles cp
    on cp.company_id = e.company_id and cp.estimate_id = e.id
  left join public.customers c
    on c.company_id = e.company_id and c.id = e.customer_id
  where e.company_id = p_company_id
    and e.id = p_estimate_id;

  if v_requested is null then
    raise exception 'Estimate % was not found for company %', p_estimate_id, p_company_id;
  end if;

  if v_property_state not in ('OH', 'OHIO') or v_contract_amount < 25000 then
    return round(greatest(v_requested, 0), 2);
  end if;

  select ce.status, ce.applicable, ce.created_at
    into v_eval_status, v_eval_applicable, v_eval_created_at
  from public.estimate_contract_compliance_evaluations ce
  where ce.company_id = p_company_id
    and ce.estimate_id = p_estimate_id
    and ce.ruleset_id = 'OH_RESIDENTIAL_HOME_CONSTRUCTION'
  order by ce.created_at desc
  limit 1;

  if v_eval_status is null then
    raise exception 'B.O.S. contract compliance review is required before this Ohio deposit invoice is created';
  end if;

  if v_profile_updated_at is not null and v_eval_created_at < v_profile_updated_at then
    raise exception 'B.O.S. contract compliance changed after the last evaluation. Recheck before creating the deposit invoice';
  end if;

  if v_eval_applicable is false then
    return round(greatest(v_requested, 0), 2);
  end if;

  if v_eval_applicable is null or v_eval_status <> 'COMPLIANT' then
    raise exception 'B.O.S. contract compliance must be cleared before a controlled deposit invoice is created';
  end if;

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

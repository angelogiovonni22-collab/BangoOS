create or replace function public.enforce_ohio_deposit_payment_compliance_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_estimate_id uuid;
  v_link_metadata jsonb := '{}'::jsonb;
  v_contract_amount numeric(14,2) := 0;
  v_eval_status text;
  v_eval_applicable boolean;
  v_pricing_type text := 'unknown';
  v_special_order_amount numeric(14,2) := 0;
  v_special_order_nonreturnable boolean := false;
  v_ordinary_limit numeric(14,2) := 0;
  v_special_limit numeric(14,2) := 0;
  v_maximum numeric(14,2) := 0;
  v_prior numeric(14,2) := 0;
  v_prospective numeric(14,2) := 0;
begin
  if new.status not in ('recorded', 'pending') then
    return new;
  end if;

  select l.estimate_id, l.metadata
    into v_estimate_id, v_link_metadata
  from public.invoice_estimate_links l
  where l.company_id = new.company_id
    and l.invoice_id = new.invoice_id
    and coalesce(l.metadata->>'kind', '') = 'deposit'
  order by l.created_at desc
  limit 1;

  if v_estimate_id is null then
    return new;
  end if;

  if coalesce(v_link_metadata->>'payment_source', '') = 'construction_loan' then
    return new;
  end if;

  select e.total_amount
    into v_contract_amount
  from public.estimates e
  where e.company_id = new.company_id
    and e.id = v_estimate_id;

  select ce.status, ce.applicable
    into v_eval_status, v_eval_applicable
  from public.estimate_contract_compliance_evaluations ce
  where ce.company_id = new.company_id
    and ce.estimate_id = v_estimate_id
    and ce.ruleset_id = 'OH_RESIDENTIAL_HOME_CONSTRUCTION'
  order by ce.created_at desc
  limit 1;

  if v_eval_status is null then
    raise exception using
      errcode = '23514',
      message = 'B.O.S. deposit compliance review is required before recording this workflow deposit payment.';
  end if;

  if v_eval_applicable is false then
    return new;
  end if;

  if v_eval_applicable is null or v_eval_status <> 'COMPLIANT' then
    raise exception using
      errcode = '23514',
      message = 'B.O.S. deposit compliance is not cleared for payment collection.';
  end if;

  select cp.pricing_type, cp.special_order_amount, cp.special_order_nonreturnable
    into v_pricing_type, v_special_order_amount, v_special_order_nonreturnable
  from public.estimate_contract_compliance_profiles cp
  where cp.company_id = new.company_id
    and cp.estimate_id = v_estimate_id
  limit 1;

  if coalesce(v_pricing_type, 'unknown') = 'cost_plus' then
    return new;
  end if;

  if coalesce(v_pricing_type, 'unknown') = 'unknown' then
    raise exception using
      errcode = '23514',
      message = 'B.O.S. requires the contract pricing classification before collecting this workflow deposit.';
  end if;

  v_ordinary_limit := round(greatest(coalesce(v_contract_amount, 0), 0) * 0.10, 2);
  if coalesce(v_special_order_nonreturnable, false) then
    v_special_limit := round(greatest(coalesce(v_special_order_amount, 0), 0) * 0.75, 2);
  end if;
  v_maximum := greatest(v_ordinary_limit, v_special_limit);

  select coalesce(sum(ph.amount), 0)
    into v_prior
  from public.invoice_payment_history ph
  where ph.company_id = new.company_id
    and ph.invoice_id = new.invoice_id
    and ph.status in ('recorded', 'pending');

  v_prospective := round(greatest(v_prior, 0) + greatest(coalesce(new.amount, 0), 0), 2);
  if v_prospective > v_maximum then
    raise exception using
      errcode = '23514',
      message = format(
        'B.O.S. blocked this Ohio pre-performance deposit: prospective payment %s exceeds the enforced ceiling %s.',
        to_char(v_prospective, 'FM9999999990.00'),
        to_char(v_maximum, 'FM9999999990.00')
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_ohio_deposit_payment_compliance on public.invoice_payment_history;
create trigger trg_enforce_ohio_deposit_payment_compliance
before insert or update of amount, status on public.invoice_payment_history
for each row execute function public.enforce_ohio_deposit_payment_compliance_fn();

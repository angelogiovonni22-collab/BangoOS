begin;

-- Project association is an operational consequence of execution, not customer-
-- facing estimate content. The atomic signature finalizer approves the estimate and
-- then converts it to a project in the same transaction. Do not classify project_id
-- as contract-content mutation or the conversion would be rejected after approval.
create or replace function public.bos_estimate_contract_mutation_guard_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_changed boolean;
begin
  v_contract_changed := row(
    old.customer_id, old.estimate_number, old.title, old.description,
    old.subtotal, old.tax_rate, old.tax_amount, old.total_amount,
    old.issue_date, old.expiration_date, old.direct_cost_subtotal, old.markup_total,
    old.discount_type, old.discount_value, old.discount_amount, old.discount_total,
    old.additional_fee, old.scope_inclusions, old.scope_exclusions, old.terms,
    old.payment_terms, old.customer_notes, old.deposit_type, old.deposit_value,
    old.deposit_amount, old.currency_code
  ) is distinct from row(
    new.customer_id, new.estimate_number, new.title, new.description,
    new.subtotal, new.tax_rate, new.tax_amount, new.total_amount,
    new.issue_date, new.expiration_date, new.direct_cost_subtotal, new.markup_total,
    new.discount_type, new.discount_value, new.discount_amount, new.discount_total,
    new.additional_fee, new.scope_inclusions, new.scope_exclusions, new.terms,
    new.payment_terms, new.customer_notes, new.deposit_type, new.deposit_value,
    new.deposit_amount, new.currency_code
  );

  if old.status = 'void' and new.status <> 'void' then
    raise exception 'VOID_ESTIMATE_IS_IMMUTABLE' using errcode = '23514';
  end if;

  if old.status = 'approved' and new.status not in ('approved', 'void') then
    raise exception 'APPROVED_ESTIMATE_STATUS_IS_TERMINAL' using errcode = '23514';
  end if;

  if old.status in ('approved', 'void') and v_contract_changed then
    raise exception 'SIGNED_OR_CANCELLED_ESTIMATE_CONTENT_IS_IMMUTABLE' using errcode = '23514';
  end if;

  if v_contract_changed then
    new.version_number := greatest(coalesce(old.version_number, 1), 1) + 1;
    perform public.bos_revoke_active_estimate_contract_tokens(old.company_id, old.id);
  else
    new.version_number := old.version_number;
  end if;

  return new;
end;
$$;

revoke execute on function public.bos_estimate_contract_mutation_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_estimate_contract_mutation_guard_fn() to service_role;

commit;

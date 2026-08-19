begin;

-- ---------------------------------------------------------------------------
-- Contract-content mutation boundary.
--
-- A public contract link is a bearer authorization for the document that existed
-- when it was issued. Material edits must revoke outstanding links, and signed or
-- cancelled estimates must be immutable at the database boundary. This protects
-- callers that bypass the normal React/service path as well as normal UI edits.
-- ---------------------------------------------------------------------------

create or replace function public.bos_revoke_active_estimate_contract_tokens(
  p_company_id uuid,
  p_estimate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.estimate_public_tokens
     set revoked_at = coalesce(revoked_at, now()),
         updated_at = now()
   where company_id = p_company_id
     and estimate_id = p_estimate_id
     and revoked_at is null
     and expires_at > now();
end;
$$;

revoke execute on function public.bos_revoke_active_estimate_contract_tokens(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.bos_revoke_active_estimate_contract_tokens(uuid,uuid)
  to service_role;

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
    old.customer_id, old.project_id, old.estimate_number, old.title, old.description,
    old.subtotal, old.tax_rate, old.tax_amount, old.total_amount,
    old.issue_date, old.expiration_date, old.direct_cost_subtotal, old.markup_total,
    old.discount_type, old.discount_value, old.discount_amount, old.discount_total,
    old.additional_fee, old.scope_inclusions, old.scope_exclusions, old.terms,
    old.payment_terms, old.customer_notes, old.deposit_type, old.deposit_value,
    old.deposit_amount, old.currency_code
  ) is distinct from row(
    new.customer_id, new.project_id, new.estimate_number, new.title, new.description,
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
    -- version_number is system-maintained; do not permit arbitrary rewrites.
    new.version_number := old.version_number;
  end if;

  return new;
end;
$$;

revoke execute on function public.bos_estimate_contract_mutation_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_estimate_contract_mutation_guard_fn()
  to service_role;

drop trigger if exists trg_bos_estimate_contract_mutation_guard on public.estimates;
create trigger trg_bos_estimate_contract_mutation_guard
before update on public.estimates
for each row execute function public.bos_estimate_contract_mutation_guard_fn();

create or replace function public.bos_estimate_line_item_contract_guard_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := coalesce(new.company_id, old.company_id);
  v_estimate_id uuid := coalesce(new.estimate_id, old.estimate_id);
  v_status text;
begin
  select e.status into v_status
  from public.estimates e
  where e.company_id = v_company_id
    and e.id = v_estimate_id;

  if not found then
    raise exception 'ESTIMATE_NOT_FOUND_FOR_LINE_ITEM' using errcode = '23503';
  end if;

  if v_status in ('approved', 'void') then
    raise exception 'SIGNED_OR_CANCELLED_ESTIMATE_LINE_ITEMS_ARE_IMMUTABLE' using errcode = '23514';
  end if;

  perform public.bos_revoke_active_estimate_contract_tokens(v_company_id, v_estimate_id);
  return coalesce(new, old);
end;
$$;

revoke execute on function public.bos_estimate_line_item_contract_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_estimate_line_item_contract_guard_fn()
  to service_role;

drop trigger if exists trg_bos_estimate_line_item_contract_guard on public.estimate_line_items;
create trigger trg_bos_estimate_line_item_contract_guard
before insert or update or delete on public.estimate_line_items
for each row execute function public.bos_estimate_line_item_contract_guard_fn();

create or replace function public.bos_customer_contract_link_invalidation_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if row(
    old.first_name, old.last_name, old.company_name, old.customer_type, old.email,
    old.address_line_1, old.address_line_2, old.city, old.state, old.postal_code
  ) is distinct from row(
    new.first_name, new.last_name, new.company_name, new.customer_type, new.email,
    new.address_line_1, new.address_line_2, new.city, new.state, new.postal_code
  ) then
    update public.estimate_public_tokens t
       set revoked_at = coalesce(t.revoked_at, now()),
           updated_at = now()
      from public.estimates e
     where e.company_id = new.company_id
       and e.customer_id = new.id
       and e.status not in ('approved', 'void')
       and t.company_id = e.company_id
       and t.estimate_id = e.id
       and t.revoked_at is null
       and t.expires_at > now();
  end if;
  return new;
end;
$$;

revoke execute on function public.bos_customer_contract_link_invalidation_fn()
  from public, anon, authenticated;
grant execute on function public.bos_customer_contract_link_invalidation_fn()
  to service_role;

drop trigger if exists trg_bos_customer_contract_link_invalidation on public.customers;
create trigger trg_bos_customer_contract_link_invalidation
before update on public.customers
for each row execute function public.bos_customer_contract_link_invalidation_fn();

create or replace function public.bos_contract_compliance_link_invalidation_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select e.status into v_status
  from public.estimates e
  where e.company_id = new.company_id
    and e.id = new.estimate_id;

  if v_status in ('approved', 'void') then
    raise exception 'SIGNED_OR_CANCELLED_CONTRACT_COMPLIANCE_IS_IMMUTABLE' using errcode = '23514';
  end if;

  perform public.bos_revoke_active_estimate_contract_tokens(new.company_id, new.estimate_id);
  return new;
end;
$$;

revoke execute on function public.bos_contract_compliance_link_invalidation_fn()
  from public, anon, authenticated;
grant execute on function public.bos_contract_compliance_link_invalidation_fn()
  to service_role;

drop trigger if exists trg_bos_contract_compliance_link_invalidation on public.estimate_contract_compliance_profiles;
create trigger trg_bos_contract_compliance_link_invalidation
before update on public.estimate_contract_compliance_profiles
for each row
when (old.* is distinct from new.*)
execute function public.bos_contract_compliance_link_invalidation_fn();

create or replace function public.bos_home_solicitation_link_invalidation_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_legal_config_changed boolean;
begin
  v_legal_config_changed := row(
    old.consumer_purpose, old.solicitation_location, old.buyer_initiated_contact,
    old.seller_has_fixed_ohio_business, old.entirely_mail_phone_buyer_initiated_no_prior_contact,
    old.final_agreement_after_prior_negotiations_at_seller_business,
    old.emergency_handwritten_waiver, old.federal_rescission_right_applies,
    old.seller_name, old.seller_address, old.cancellation_email, old.cancellation_fax,
    old.notice_template_ready, old.duplicate_notice_configured,
    old.signed_seller_copy_configured, old.seller_signer_name, old.seller_signed_at,
    old.seller_signed_by, old.assisted_live_signing, old.oral_disclosure_workflow_confirmed,
    old.oral_disclosure_confirmed_at, old.oral_disclosure_confirmed_by,
    old.work_start_hold_configured
  ) is distinct from row(
    new.consumer_purpose, new.solicitation_location, new.buyer_initiated_contact,
    new.seller_has_fixed_ohio_business, new.entirely_mail_phone_buyer_initiated_no_prior_contact,
    new.final_agreement_after_prior_negotiations_at_seller_business,
    new.emergency_handwritten_waiver, new.federal_rescission_right_applies,
    new.seller_name, new.seller_address, new.cancellation_email, new.cancellation_fax,
    new.notice_template_ready, new.duplicate_notice_configured,
    new.signed_seller_copy_configured, new.seller_signer_name, new.seller_signed_at,
    new.seller_signed_by, new.assisted_live_signing, new.oral_disclosure_workflow_confirmed,
    new.oral_disclosure_confirmed_at, new.oral_disclosure_confirmed_by,
    new.work_start_hold_configured
  );

  if not v_legal_config_changed then
    return new;
  end if;

  select e.status into v_status
  from public.estimates e
  where e.company_id = new.company_id
    and e.id = new.estimate_id;

  if v_status in ('approved', 'void') then
    raise exception 'SIGNED_OR_CANCELLED_HOME_SOLICITATION_CONFIGURATION_IS_IMMUTABLE' using errcode = '23514';
  end if;

  perform public.bos_revoke_active_estimate_contract_tokens(new.company_id, new.estimate_id);
  return new;
end;
$$;

revoke execute on function public.bos_home_solicitation_link_invalidation_fn()
  from public, anon, authenticated;
grant execute on function public.bos_home_solicitation_link_invalidation_fn()
  to service_role;

drop trigger if exists trg_bos_home_solicitation_link_invalidation on public.estimate_home_solicitation_profiles;
create trigger trg_bos_home_solicitation_link_invalidation
before update on public.estimate_home_solicitation_profiles
for each row execute function public.bos_home_solicitation_link_invalidation_fn();

commit;

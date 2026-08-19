begin;

-- ---------------------------------------------------------------------------
-- Subcontract authorization content boundary.
--
-- A sent work authorization is a legal snapshot of the assignment terms. If those
-- terms change before signature, invalidate the outstanding bearer link and force a
-- fresh authorization. After signature, the executed terms are immutable here;
-- additional scope belongs in a new authorization/change-order workflow.
-- ---------------------------------------------------------------------------

create or replace function public.bos_trade_partner_assignment_contract_guard_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_authorization public.project_subcontract_work_authorizations%rowtype;
  v_contract_changed boolean;
  v_now timestamptz := now();
begin
  v_contract_changed := row(
    old.trade_name,
    old.scope_of_work,
    old.contract_amount,
    old.payment_terms,
    old.retainage_percent,
    old.start_date,
    old.target_completion_date
  ) is distinct from row(
    new.trade_name,
    new.scope_of_work,
    new.contract_amount,
    new.payment_terms,
    new.retainage_percent,
    new.start_date,
    new.target_completion_date
  );

  if not v_contract_changed then
    return new;
  end if;

  select * into v_authorization
  from public.project_subcontract_work_authorizations a
  where a.company_id = old.company_id
    and a.assignment_id = old.id
  for update;

  if not found then
    return new;
  end if;

  if v_authorization.status = 'signed' then
    raise exception 'SIGNED_WORK_AUTHORIZATION_TERMS_ARE_IMMUTABLE'
      using errcode = '23514';
  end if;

  if v_authorization.status in ('draft', 'sent') then
    update public.project_subcontract_work_authorizations
       set status = 'void',
           public_token_hash = null,
           token_expires_at = null,
           updated_at = v_now
     where id = v_authorization.id;

    if v_authorization.master_agreement_id is not null then
      update public.subcontractor_master_agreements
         set public_token_hash = null,
             token_expires_at = null,
             updated_at = v_now
       where id = v_authorization.master_agreement_id
         and status <> 'signed'
         and public_token_hash = v_authorization.public_token_hash;
    end if;

    insert into public.subcontractor_signature_events(
      company_id,
      vendor_id,
      assignment_id,
      master_agreement_id,
      work_authorization_id,
      event_type,
      signer_email,
      document_hash,
      metadata
    ) values (
      v_authorization.company_id,
      v_authorization.vendor_id,
      v_authorization.assignment_id,
      v_authorization.master_agreement_id,
      v_authorization.id,
      'voided',
      v_authorization.signer_email,
      v_authorization.authorization_hash,
      jsonb_build_object('reason', 'assignment_contract_terms_changed')
    );

    update public.subcontractor_mobilization_requirements
       set status = 'pending',
           verified_at = null,
           evidence = '{}'::jsonb,
           updated_at = v_now
     where company_id = old.company_id
       and assignment_id = old.id
       and requirement_type in ('work_authorization', 'scope_confirmation');

    new.contract_status := 'draft';
    new.mobilization_status := 'not_cleared';
    new.mobilization_cleared_at := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.bos_trade_partner_assignment_contract_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_trade_partner_assignment_contract_guard_fn()
  to service_role;

drop trigger if exists trg_bos_trade_partner_assignment_contract_guard on public.trade_partner_assignments;
create trigger trg_bos_trade_partner_assignment_contract_guard
before update on public.trade_partner_assignments
for each row execute function public.bos_trade_partner_assignment_contract_guard_fn();

-- Defense in depth: after execution, neither legal snapshot nor hash may be
-- rewritten directly through a privileged internal path. Lifecycle-only fields
-- (for example mobilization) live elsewhere and remain unaffected.
create or replace function public.bos_signed_subcontract_document_guard_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'signed' and row(
    old.agreement_version,
    old.agreement_snapshot,
    old.agreement_hash,
    old.vendor_id,
    old.company_id
  ) is distinct from row(
    new.agreement_version,
    new.agreement_snapshot,
    new.agreement_hash,
    new.vendor_id,
    new.company_id
  ) then
    raise exception 'SIGNED_MASTER_SUBCONTRACT_IS_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.bos_signed_subcontract_document_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_signed_subcontract_document_guard_fn()
  to service_role;

drop trigger if exists trg_bos_signed_subcontract_document_guard on public.subcontractor_master_agreements;
create trigger trg_bos_signed_subcontract_document_guard
before update on public.subcontractor_master_agreements
for each row execute function public.bos_signed_subcontract_document_guard_fn();

create or replace function public.bos_signed_work_authorization_document_guard_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'signed' and row(
    old.authorization_version,
    old.authorization_snapshot,
    old.authorization_hash,
    old.scope_of_work,
    old.contract_amount,
    old.payment_terms,
    old.retainage_percent,
    old.start_date,
    old.target_completion_date,
    old.project_id,
    old.assignment_id,
    old.vendor_id,
    old.master_agreement_id,
    old.company_id
  ) is distinct from row(
    new.authorization_version,
    new.authorization_snapshot,
    new.authorization_hash,
    new.scope_of_work,
    new.contract_amount,
    new.payment_terms,
    new.retainage_percent,
    new.start_date,
    new.target_completion_date,
    new.project_id,
    new.assignment_id,
    new.vendor_id,
    new.master_agreement_id,
    new.company_id
  ) then
    raise exception 'SIGNED_WORK_AUTHORIZATION_IS_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.bos_signed_work_authorization_document_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_signed_work_authorization_document_guard_fn()
  to service_role;

drop trigger if exists trg_bos_signed_work_authorization_document_guard on public.project_subcontract_work_authorizations;
create trigger trg_bos_signed_work_authorization_document_guard
before update on public.project_subcontract_work_authorizations
for each row execute function public.bos_signed_work_authorization_document_guard_fn();

commit;

begin;

-- ---------------------------------------------------------------------------
-- Executed contract evidence immutability.
--
-- Once a customer signature is verified, the signature row, the referenced
-- agreement version, the estimate's executed-evidence pointers and append-only
-- legal audit records must not be rewritable or deletable through any privileged
-- application path. Corrections belong in a new revision/event, never in history.
-- ---------------------------------------------------------------------------

create or replace function public.bos_verified_estimate_signature_guard_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agreement_hash text;
begin
  if tg_op = 'DELETE' then
    if old.verification_result = 'verified' then
      raise exception 'VERIFIED_ESTIMATE_SIGNATURE_IS_IMMUTABLE' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.verification_result = 'verified' and new is distinct from old then
    raise exception 'VERIFIED_ESTIMATE_SIGNATURE_IS_IMMUTABLE' using errcode = '23514';
  end if;

  if new.verification_result = 'verified' then
    if new.consent_accepted is not true
       or nullif(btrim(coalesce(new.typed_name, '')), '') is null
       or nullif(btrim(coalesce(new.signature_hash, '')), '') is null
       or nullif(btrim(coalesce(new.idempotency_key, '')), '') is null then
      raise exception 'VERIFIED_SIGNATURE_EVIDENCE_INCOMPLETE' using errcode = '23514';
    end if;

    select av.agreement_hash
      into v_agreement_hash
    from public.estimate_agreement_versions av
    where av.id = new.agreement_version_id
      and av.company_id = new.company_id
      and av.estimate_id = new.estimate_id;

    if not found then
      raise exception 'VERIFIED_SIGNATURE_AGREEMENT_VERSION_MISSING' using errcode = '23514';
    end if;

    if nullif(btrim(coalesce(new.metadata ->> 'agreement_hash', '')), '') is null
       or new.metadata ->> 'agreement_hash' <> v_agreement_hash then
      raise exception 'VERIFIED_SIGNATURE_AGREEMENT_HASH_MISMATCH' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.bos_verified_estimate_signature_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_verified_estimate_signature_guard_fn() to service_role;

drop trigger if exists trg_bos_verified_estimate_signature_guard on public.estimate_signatures;
create trigger trg_bos_verified_estimate_signature_guard
before insert or update or delete on public.estimate_signatures
for each row execute function public.bos_verified_estimate_signature_guard_fn();

create or replace function public.bos_executed_agreement_version_guard_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.estimate_signatures s
    where s.agreement_version_id = old.id
      and s.company_id = old.company_id
      and s.estimate_id = old.estimate_id
      and s.verification_result = 'verified'
  ) or exists (
    select 1
    from public.estimates e
    where e.company_id = old.company_id
      and e.id = old.estimate_id
      and e.agreement_version_id = old.id
      and e.approval_signature_id is not null
  ) then
    raise exception 'EXECUTED_AGREEMENT_VERSION_IS_IMMUTABLE' using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.bos_executed_agreement_version_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_executed_agreement_version_guard_fn() to service_role;

drop trigger if exists trg_bos_executed_agreement_version_guard on public.estimate_agreement_versions;
create trigger trg_bos_executed_agreement_version_guard
before update or delete on public.estimate_agreement_versions
for each row execute function public.bos_executed_agreement_version_guard_fn();

create or replace function public.bos_executed_estimate_evidence_guard_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.approval_signature_id is not null and row(
    old.agreement_version_id,
    old.agreement_snapshot,
    old.agreement_hash,
    old.approval_signature_id,
    old.approved_at,
    old.deleted_at,
    old.deleted_by
  ) is distinct from row(
    new.agreement_version_id,
    new.agreement_snapshot,
    new.agreement_hash,
    new.approval_signature_id,
    new.approved_at,
    new.deleted_at,
    new.deleted_by
  ) then
    raise exception 'EXECUTED_ESTIMATE_EVIDENCE_IS_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.bos_executed_estimate_evidence_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_executed_estimate_evidence_guard_fn() to service_role;

drop trigger if exists trg_bos_executed_estimate_evidence_guard on public.estimates;
create trigger trg_bos_executed_estimate_evidence_guard
before update on public.estimates
for each row execute function public.bos_executed_estimate_evidence_guard_fn();

create or replace function public.bos_append_only_legal_evidence_guard_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'LEGAL_EVIDENCE_IS_APPEND_ONLY' using errcode = '23514';
end;
$$;

revoke execute on function public.bos_append_only_legal_evidence_guard_fn()
  from public, anon, authenticated;
grant execute on function public.bos_append_only_legal_evidence_guard_fn() to service_role;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'estimate_acceptance_events',
    'estimate_home_solicitation_events',
    'estimate_home_solicitation_cancellations',
    'subcontractor_signature_events'
  ]
  loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;
    execute format('drop trigger if exists trg_bos_append_only_legal_evidence on public.%I', v_table);
    execute format(
      'create trigger trg_bos_append_only_legal_evidence before update or delete on public.%I for each row execute function public.bos_append_only_legal_evidence_guard_fn()',
      v_table
    );
  end loop;
end $$;

commit;

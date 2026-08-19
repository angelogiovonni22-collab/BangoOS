begin;

-- ---------------------------------------------------------------------------
-- Contract-link and signature invariants
--
-- Public estimate links are bearer credentials. Issuing a replacement link must
-- invalidate older still-active links so a stale email cannot authorize a newer
-- revision of the same estimate. Verified signatures are likewise terminal legal
-- evidence: future writes may never create a second verified signature for one
-- estimate. These guards preserve existing historical rows while enforcing the
-- invariant prospectively at the database boundary.
-- ---------------------------------------------------------------------------

create or replace function public.bos_revoke_prior_estimate_public_tokens_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.estimate_public_tokens t
     set revoked_at = coalesce(t.revoked_at, now()),
         revoked_by = coalesce(t.revoked_by, new.issued_by),
         updated_at = now()
   where t.company_id = new.company_id
     and t.estimate_id = new.estimate_id
     and t.id <> new.id
     and t.revoked_at is null
     and t.expires_at > now();

  return new;
end;
$$;

revoke execute on function public.bos_revoke_prior_estimate_public_tokens_fn() from public, anon, authenticated;
grant execute on function public.bos_revoke_prior_estimate_public_tokens_fn() to service_role;

drop trigger if exists trg_bos_revoke_prior_estimate_public_tokens on public.estimate_public_tokens;
create trigger trg_bos_revoke_prior_estimate_public_tokens
after insert on public.estimate_public_tokens
for each row execute function public.bos_revoke_prior_estimate_public_tokens_fn();

create index if not exists idx_estimate_public_tokens_active_lookup
  on public.estimate_public_tokens(company_id, estimate_id, expires_at desc)
  where revoked_at is null;

create or replace function public.bos_guard_single_verified_estimate_signature_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.verification_result = 'verified'
     and exists (
       select 1
       from public.estimate_signatures s
       where s.company_id = new.company_id
         and s.estimate_id = new.estimate_id
         and s.verification_result = 'verified'
         and s.id <> new.id
     ) then
    raise exception 'ESTIMATE_ALREADY_HAS_VERIFIED_SIGNATURE'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke execute on function public.bos_guard_single_verified_estimate_signature_fn() from public, anon, authenticated;
grant execute on function public.bos_guard_single_verified_estimate_signature_fn() to service_role;

drop trigger if exists trg_bos_guard_single_verified_estimate_signature on public.estimate_signatures;
create trigger trg_bos_guard_single_verified_estimate_signature
before insert or update of verification_result, company_id, estimate_id
on public.estimate_signatures
for each row execute function public.bos_guard_single_verified_estimate_signature_fn();

create index if not exists idx_estimate_signatures_verified_lookup
  on public.estimate_signatures(company_id, estimate_id)
  where verification_result = 'verified';

commit;

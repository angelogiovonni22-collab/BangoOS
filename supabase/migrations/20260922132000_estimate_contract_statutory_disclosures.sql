alter table public.estimate_contract_compliance_profiles
  add column if not exists supplier_taxpayer_id text,
  add column if not exists contract_language text not null default 'unknown',
  add column if not exists insurance_certificate_url text,
  add column if not exists supplier_signer_name text,
  add column if not exists supplier_signed_at timestamptz,
  add column if not exists supplier_signature_confirmed boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'estimate_contract_compliance_profiles_contract_language_check'
  ) then
    alter table public.estimate_contract_compliance_profiles
      add constraint estimate_contract_compliance_profiles_contract_language_check
      check (contract_language in ('en','es','unknown'));
  end if;
end $$;

comment on column public.estimate_contract_compliance_profiles.supplier_taxpayer_id is
  'Taxpayer identification number required in covered Ohio home-construction contracts. Expose only through tenant-authorized admin views and secure customer contract links.';
comment on column public.estimate_contract_compliance_profiles.insurance_certificate_url is
  'Customer-viewable URL for the certificate of general liability insurance incorporated into a covered Ohio contract package.';
comment on column public.estimate_contract_compliance_profiles.supplier_signature_confirmed is
  'Explicit supplier-side confirmation that the named authorized signer signs the estimate/contract.';

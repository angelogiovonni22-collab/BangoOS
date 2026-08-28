begin;

alter table public.vendors
  add column if not exists primary_trade text,
  add column if not exists market_type text,
  add column if not exists years_in_business integer,
  add column if not exists crew_size integer,
  add column if not exists service_area text,
  add column if not exists contractor_license text,
  add column if not exists insurance_provider text,
  add column if not exists insurance_expires_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.vendors
  drop constraint if exists vendors_market_type_check,
  add constraint vendors_market_type_check check (market_type is null or market_type in ('residential','commercial','both')),
  drop constraint if exists vendors_years_in_business_non_negative_check,
  add constraint vendors_years_in_business_non_negative_check check (years_in_business is null or years_in_business >= 0),
  drop constraint if exists vendors_crew_size_positive_check,
  add constraint vendors_crew_size_positive_check check (crew_size is null or crew_size > 0);

create table if not exists public.trade_partner_onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null,
  requirement_type text not null check (requirement_type in ('w9','coi','workers_comp','licenses')),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 20971520),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active','superseded','deleted')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vendor_id, company_id) references public.vendors(id, company_id) on delete cascade
);

create index if not exists trade_partner_onboarding_documents_vendor_idx
  on public.trade_partner_onboarding_documents(company_id, vendor_id, requirement_type, created_at desc);

alter table public.trade_partner_onboarding_documents enable row level security;

create policy trade_partner_onboarding_documents_partner_select on public.trade_partner_onboarding_documents
for select to authenticated using (
  exists(
    select 1 from public.company_memberships m
    where m.user_id = auth.uid()
      and m.company_id = trade_partner_onboarding_documents.company_id
      and m.vendor_id = trade_partner_onboarding_documents.vendor_id
      and m.status = 'active'
      and lower(m.role) = 'subcontractor'
  )
);

create policy trade_partner_onboarding_documents_internal_select on public.trade_partner_onboarding_documents
for select to authenticated using (
  public.has_company_role(company_id, array['owner','administrator','office_manager','project_manager'])
);

create policy trade_partner_onboarding_documents_internal_update on public.trade_partner_onboarding_documents
for update to authenticated using (
  public.has_company_role(company_id, array['owner','administrator','office_manager','project_manager'])
) with check (
  public.has_company_role(company_id, array['owner','administrator','office_manager','project_manager'])
);

create policy trade_partner_onboarding_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'subcontractor-compliance'
  and exists(
    select 1
    from public.trade_partner_onboarding_documents d
    left join public.company_memberships m
      on m.company_id = d.company_id
     and m.vendor_id = d.vendor_id
     and m.user_id = auth.uid()
     and m.status = 'active'
     and lower(m.role) = 'subcontractor'
    where d.storage_path = name
      and d.status = 'active'
      and (
        m.user_id is not null
        or public.has_company_role(d.company_id, array['owner','administrator','office_manager','project_manager'])
      )
  )
);

commit;

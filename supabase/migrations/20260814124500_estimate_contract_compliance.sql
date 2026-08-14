create table if not exists public.estimate_contract_compliance_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  property_state text,
  property_class text not null default 'unknown',
  pricing_type text not null default 'unknown',
  supplier_legal_name text,
  supplier_physical_address text,
  supplier_phone text,
  supplier_taxpayer_id_present boolean not null default false,
  owner_name text,
  owner_address text,
  owner_phone text,
  project_address text,
  anticipated_start text,
  anticipated_completion text,
  excluded_costs_disclosed boolean not null default false,
  liability_insurance_documented boolean not null default false,
  liability_coverage_amount numeric(14,2),
  insurance_document_reference text,
  excess_cost_method text,
  deposit_amount numeric(14,2),
  special_order_amount numeric(14,2),
  special_order_nonreturnable boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, estimate_id),
  constraint estimate_contract_compliance_property_class_check check (property_class in ('one_to_three_family','individual_unit_in_four_plus','four_plus_common_or_building','condominium_common_area','manufactured_or_mobile','unknown')),
  constraint estimate_contract_compliance_pricing_type_check check (pricing_type in ('fixed','estimated','cost_plus','unknown')),
  constraint estimate_contract_compliance_excess_method_check check (excess_cost_method is null or excess_cost_method in ('written','oral','firm_price_no_excess'))
);

create index if not exists estimate_contract_compliance_profiles_company_estimate_idx
  on public.estimate_contract_compliance_profiles(company_id, estimate_id);

create table if not exists public.estimate_contract_compliance_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  profile_id uuid references public.estimate_contract_compliance_profiles(id) on delete set null,
  ruleset_id text not null,
  ruleset_version text not null,
  jurisdiction text not null,
  status text not null,
  applicable boolean,
  evaluation jsonb not null,
  evaluated_by uuid,
  created_at timestamptz not null default now(),
  constraint estimate_contract_compliance_evaluation_status_check check (status in ('COMPLIANT','ACTION_REQUIRED','REVIEW_REQUIRED'))
);

create index if not exists estimate_contract_compliance_evaluations_lookup_idx
  on public.estimate_contract_compliance_evaluations(company_id, estimate_id, created_at desc);

alter table public.estimate_contract_compliance_profiles enable row level security;
alter table public.estimate_contract_compliance_evaluations enable row level security;

create policy "estimate_contract_compliance_profiles_company_members"
on public.estimate_contract_compliance_profiles
for all
to authenticated
using (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = estimate_contract_compliance_profiles.company_id
    and cm.user_id = auth.uid()
))
with check (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = estimate_contract_compliance_profiles.company_id
    and cm.user_id = auth.uid()
));

create policy "estimate_contract_compliance_evaluations_company_members_read"
on public.estimate_contract_compliance_evaluations
for select
to authenticated
using (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = estimate_contract_compliance_evaluations.company_id
    and cm.user_id = auth.uid()
));

create policy "estimate_contract_compliance_evaluations_company_members_insert"
on public.estimate_contract_compliance_evaluations
for insert
to authenticated
with check (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = estimate_contract_compliance_evaluations.company_id
    and cm.user_id = auth.uid()
));
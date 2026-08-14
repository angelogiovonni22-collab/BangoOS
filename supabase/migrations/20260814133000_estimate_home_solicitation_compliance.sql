create table if not exists public.estimate_home_solicitation_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  consumer_purpose text not null default 'unknown',
  solicitation_location text not null default 'unknown',
  buyer_initiated_contact boolean,
  seller_has_fixed_ohio_business boolean,
  entirely_mail_phone_buyer_initiated_no_prior_contact boolean not null default false,
  final_agreement_after_prior_negotiations_at_seller_business boolean not null default false,
  emergency_handwritten_waiver boolean not null default false,
  federal_rescission_right_applies boolean,
  seller_name text,
  seller_address text,
  cancellation_email text,
  cancellation_fax text,
  notice_template_ready boolean not null default false,
  duplicate_notice_configured boolean not null default false,
  signed_seller_copy_configured boolean not null default false,
  seller_signer_name text,
  seller_signed_at timestamptz,
  seller_signed_by uuid references auth.users(id) on delete set null,
  assisted_live_signing boolean not null default false,
  oral_disclosure_workflow_confirmed boolean not null default false,
  oral_disclosure_confirmed_at timestamptz,
  oral_disclosure_confirmed_by uuid references auth.users(id) on delete set null,
  work_start_hold_configured boolean not null default false,
  transaction_signed_at timestamptz,
  cancellation_deadline_date date,
  cancelled_at timestamptz,
  work_released_at timestamptz,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, estimate_id),
  constraint estimate_home_solicitation_consumer_purpose_check check (consumer_purpose in ('yes','no','unknown')),
  constraint estimate_home_solicitation_location_check check (solicitation_location in ('buyer_residence','seller_place_of_business','other_away_from_business','remote','unknown'))
);

create index if not exists estimate_home_solicitation_profiles_lookup_idx
  on public.estimate_home_solicitation_profiles(company_id, estimate_id);

alter table public.estimate_home_solicitation_profiles enable row level security;

create policy "estimate_home_solicitation_profiles_active_company_members"
on public.estimate_home_solicitation_profiles
for all
to authenticated
using (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = estimate_home_solicitation_profiles.company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
))
with check (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = estimate_home_solicitation_profiles.company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
));

create table if not exists public.estimate_home_solicitation_cancellations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  public_token_id uuid,
  received_at timestamptz not null default now(),
  effective_date date,
  deadline_date date,
  timely boolean,
  notice_text text not null,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists estimate_home_solicitation_cancellations_lookup_idx
  on public.estimate_home_solicitation_cancellations(company_id, estimate_id, received_at desc);

alter table public.estimate_home_solicitation_cancellations enable row level security;

create policy "estimate_home_solicitation_cancellations_active_company_members_read"
on public.estimate_home_solicitation_cancellations
for select
to authenticated
using (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = estimate_home_solicitation_cancellations.company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
));

alter table public.projects
  add column if not exists contract_compliance_hold_active boolean not null default false,
  add column if not exists contract_compliance_hold_until timestamptz,
  add column if not exists contract_compliance_hold_reason text;

create index if not exists projects_contract_compliance_hold_idx
  on public.projects(company_id, contract_compliance_hold_active, contract_compliance_hold_until);
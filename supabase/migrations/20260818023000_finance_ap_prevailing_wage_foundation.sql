begin;

-- Finance / AP + Prevailing Wage foundation
-- Company-scoped, project-aware, and compatible with the existing vendor,
-- project, cost-code, procurement, workforce, and compliance architecture.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendors_id_company_unique'
  ) then
    alter table public.vendors
      add constraint vendors_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'projects_id_company_unique'
  ) then
    alter table public.projects
      add constraint projects_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'cost_codes_id_company_unique'
  ) then
    alter table public.cost_codes
      add constraint cost_codes_id_company_unique unique (id, company_id);
  end if;
end $$;

create table if not exists public.vendor_bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null,
  project_id uuid null,
  purchase_order_id uuid null,
  bill_number text not null,
  vendor_invoice_number text null,
  bill_date date not null,
  due_date date null,
  status text not null default 'draft',
  subtotal_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  retainage_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) generated always as (greatest(total_amount - amount_paid, 0)) stored,
  payment_terms text null,
  memo text null,
  attachments jsonb not null default '[]'::jsonb,
  approved_at timestamptz null,
  approved_by uuid null,
  voided_at timestamptz null,
  voided_by uuid null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vendor_bills_bill_number_not_blank_check check (btrim(bill_number) <> ''),
  constraint vendor_bills_status_check check (status in ('draft','submitted','approved','partially_paid','paid','voided','disputed')),
  constraint vendor_bills_subtotal_non_negative_check check (subtotal_amount >= 0),
  constraint vendor_bills_tax_non_negative_check check (tax_amount >= 0),
  constraint vendor_bills_retainage_non_negative_check check (retainage_amount >= 0),
  constraint vendor_bills_total_non_negative_check check (total_amount >= 0),
  constraint vendor_bills_paid_non_negative_check check (amount_paid >= 0),
  constraint vendor_bills_paid_not_over_total_check check (amount_paid <= total_amount),
  constraint vendor_bills_attachments_array_check check (jsonb_typeof(attachments) = 'array')
);

create table if not exists public.vendor_bill_line_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_bill_id uuid not null,
  project_id uuid null,
  cost_code_id uuid null,
  purchase_order_line_item_id uuid null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_cost numeric(14,4) not null default 0,
  line_amount numeric(14,2) not null default 0,
  category text not null default 'other',
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vendor_bill_line_items_description_not_blank_check check (btrim(description) <> ''),
  constraint vendor_bill_line_items_quantity_positive_check check (quantity > 0),
  constraint vendor_bill_line_items_unit_cost_non_negative_check check (unit_cost >= 0),
  constraint vendor_bill_line_items_line_amount_non_negative_check check (line_amount >= 0),
  constraint vendor_bill_line_items_category_check check (category in ('materials','subcontractor','equipment','rental','permit','professional_service','overhead','other'))
);

create table if not exists public.vendor_bill_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_bill_id uuid not null,
  payment_date date not null,
  amount numeric(14,2) not null,
  payment_method text null,
  reference_number text null,
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),

  constraint vendor_bill_payments_amount_positive_check check (amount > 0)
);

create table if not exists public.prevailing_wage_project_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  applicability text not null default 'not_applicable',
  jurisdiction text not null default 'none',
  determination_number text null,
  determination_title text null,
  decision_date date null,
  effective_date date null,
  expiration_date date null,
  wage_source_url text null,
  contracting_agency text null,
  project_number text null,
  certified_payroll_required boolean not null default false,
  weekly_statement_required boolean not null default false,
  wage_posting_required boolean not null default false,
  completion_affidavit_required boolean not null default false,
  lower_tier_tracking_required boolean not null default true,
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prevailing_wage_project_profiles_applicability_check check (applicability in ('not_applicable','federal_dbra','ohio_public_improvement','state_local_other')),
  constraint prevailing_wage_project_profiles_jurisdiction_check check (jurisdiction in ('none','federal','ohio','other')),
  constraint prevailing_wage_project_profiles_project_unique unique (company_id, project_id)
);

create table if not exists public.prevailing_wage_classifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null,
  classification_code text null,
  classification_name text not null,
  trade_group text null,
  county text null,
  base_hourly_rate numeric(12,4) not null,
  fringe_hourly_rate numeric(12,4) not null default 0,
  combined_hourly_rate numeric(12,4) generated always as (base_hourly_rate + fringe_hourly_rate) stored,
  overtime_multiplier numeric(8,4) not null default 1.5,
  apprentice_allowed boolean not null default false,
  source_reference text null,
  effective_date date null,
  expiration_date date null,
  active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prevailing_wage_classifications_name_not_blank_check check (btrim(classification_name) <> ''),
  constraint prevailing_wage_classifications_base_non_negative_check check (base_hourly_rate >= 0),
  constraint prevailing_wage_classifications_fringe_non_negative_check check (fringe_hourly_rate >= 0),
  constraint prevailing_wage_classifications_ot_multiplier_check check (overtime_multiplier >= 1)
);

create table if not exists public.prevailing_wage_worker_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  employee_id uuid null,
  trade_partner_assignment_id uuid null,
  classification_id uuid not null,
  apprentice boolean not null default false,
  apprentice_program_name text null,
  apprentice_registration_number text null,
  apprentice_level text null,
  apprentice_percentage numeric(8,4) null,
  cash_fringe_hourly numeric(12,4) not null default 0,
  bona_fide_fringe_hourly numeric(12,4) not null default 0,
  effective_date date not null default current_date,
  end_date date null,
  active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prevailing_wage_worker_assignments_worker_check check (
    (employee_id is not null and trade_partner_assignment_id is null)
    or (employee_id is null and trade_partner_assignment_id is not null)
  ),
  constraint prevailing_wage_worker_assignments_apprentice_pct_check check (apprentice_percentage is null or (apprentice_percentage >= 0 and apprentice_percentage <= 100)),
  constraint prevailing_wage_worker_assignments_cash_fringe_non_negative_check check (cash_fringe_hourly >= 0),
  constraint prevailing_wage_worker_assignments_bona_fide_fringe_non_negative_check check (bona_fide_fringe_hourly >= 0)
);

create table if not exists public.prevailing_wage_time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  worker_assignment_id uuid not null,
  work_date date not null,
  regular_hours numeric(8,2) not null default 0,
  overtime_hours numeric(8,2) not null default 0,
  doubletime_hours numeric(8,2) not null default 0,
  actual_base_rate numeric(12,4) not null default 0,
  actual_cash_fringe numeric(12,4) not null default 0,
  actual_bona_fide_fringe numeric(12,4) not null default 0,
  gross_wages numeric(14,2) not null default 0,
  source_time_entry_id uuid null,
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prevailing_wage_time_entries_regular_non_negative_check check (regular_hours >= 0),
  constraint prevailing_wage_time_entries_overtime_non_negative_check check (overtime_hours >= 0),
  constraint prevailing_wage_time_entries_doubletime_non_negative_check check (doubletime_hours >= 0),
  constraint prevailing_wage_time_entries_rates_non_negative_check check (actual_base_rate >= 0 and actual_cash_fringe >= 0 and actual_bona_fide_fringe >= 0),
  constraint prevailing_wage_time_entries_gross_non_negative_check check (gross_wages >= 0)
);

create table if not exists public.certified_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  week_ending_date date not null,
  payroll_number text null,
  status text not null default 'draft',
  statement_of_compliance_signed boolean not null default false,
  statement_signed_at timestamptz null,
  statement_signed_by uuid null,
  submitted_at timestamptz null,
  submitted_by uuid null,
  submission_reference text null,
  attachments jsonb not null default '[]'::jsonb,
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint certified_payroll_periods_status_check check (status in ('draft','review','ready','submitted','accepted','rejected','corrected')),
  constraint certified_payroll_periods_attachments_array_check check (jsonb_typeof(attachments) = 'array'),
  constraint certified_payroll_periods_project_week_unique unique (company_id, project_id, week_ending_date)
);

create table if not exists public.certified_payroll_worker_rows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  certified_payroll_period_id uuid not null,
  worker_assignment_id uuid not null,
  classification_id uuid not null,
  worker_name text not null,
  worker_identifier text null,
  regular_hours numeric(8,2) not null default 0,
  overtime_hours numeric(8,2) not null default 0,
  gross_amount numeric(14,2) not null default 0,
  base_rate_paid numeric(12,4) not null default 0,
  fringe_cash_paid numeric(12,4) not null default 0,
  fringe_credit_applied numeric(12,4) not null default 0,
  deductions_amount numeric(14,2) not null default 0,
  net_wages numeric(14,2) not null default 0,
  compliance_status text not null default 'pending',
  deficiency_amount numeric(14,2) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint certified_payroll_worker_rows_name_not_blank_check check (btrim(worker_name) <> ''),
  constraint certified_payroll_worker_rows_hours_non_negative_check check (regular_hours >= 0 and overtime_hours >= 0),
  constraint certified_payroll_worker_rows_amounts_non_negative_check check (
    gross_amount >= 0 and base_rate_paid >= 0 and fringe_cash_paid >= 0 and fringe_credit_applied >= 0 and deductions_amount >= 0 and net_wages >= 0 and deficiency_amount >= 0
  ),
  constraint certified_payroll_worker_rows_compliance_status_check check (compliance_status in ('pending','compliant','underpaid','classification_issue','apprentice_issue','missing_data'))
);

-- Composite company-scoped keys.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vendor_bills_id_company_unique') then
    alter table public.vendor_bills add constraint vendor_bills_id_company_unique unique (id, company_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prevailing_wage_profiles_id_company_unique') then
    alter table public.prevailing_wage_project_profiles add constraint prevailing_wage_profiles_id_company_unique unique (id, company_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prevailing_wage_classifications_id_company_unique') then
    alter table public.prevailing_wage_classifications add constraint prevailing_wage_classifications_id_company_unique unique (id, company_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prevailing_wage_worker_assignments_id_company_unique') then
    alter table public.prevailing_wage_worker_assignments add constraint prevailing_wage_worker_assignments_id_company_unique unique (id, company_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'certified_payroll_periods_id_company_unique') then
    alter table public.certified_payroll_periods add constraint certified_payroll_periods_id_company_unique unique (id, company_id);
  end if;
end $$;

-- Strict company-scoped foreign keys.
alter table public.vendor_bills
  drop constraint if exists vendor_bills_vendor_company_fkey,
  add constraint vendor_bills_vendor_company_fkey foreign key (vendor_id, company_id) references public.vendors(id, company_id) on delete restrict;
alter table public.vendor_bills
  drop constraint if exists vendor_bills_project_company_fkey,
  add constraint vendor_bills_project_company_fkey foreign key (project_id, company_id) references public.projects(id, company_id) on delete set null;

alter table public.vendor_bill_line_items
  drop constraint if exists vendor_bill_line_items_bill_company_fkey,
  add constraint vendor_bill_line_items_bill_company_fkey foreign key (vendor_bill_id, company_id) references public.vendor_bills(id, company_id) on delete cascade;
alter table public.vendor_bill_line_items
  drop constraint if exists vendor_bill_line_items_project_company_fkey,
  add constraint vendor_bill_line_items_project_company_fkey foreign key (project_id, company_id) references public.projects(id, company_id) on delete set null;
alter table public.vendor_bill_line_items
  drop constraint if exists vendor_bill_line_items_cost_code_company_fkey,
  add constraint vendor_bill_line_items_cost_code_company_fkey foreign key (cost_code_id, company_id) references public.cost_codes(id, company_id) on delete set null;

alter table public.vendor_bill_payments
  drop constraint if exists vendor_bill_payments_bill_company_fkey,
  add constraint vendor_bill_payments_bill_company_fkey foreign key (vendor_bill_id, company_id) references public.vendor_bills(id, company_id) on delete cascade;

alter table public.prevailing_wage_project_profiles
  drop constraint if exists prevailing_wage_profiles_project_company_fkey,
  add constraint prevailing_wage_profiles_project_company_fkey foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade;

alter table public.prevailing_wage_classifications
  drop constraint if exists prevailing_wage_classifications_profile_company_fkey,
  add constraint prevailing_wage_classifications_profile_company_fkey foreign key (profile_id, company_id) references public.prevailing_wage_project_profiles(id, company_id) on delete cascade;

alter table public.prevailing_wage_worker_assignments
  drop constraint if exists prevailing_wage_worker_assignments_project_company_fkey,
  add constraint prevailing_wage_worker_assignments_project_company_fkey foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade;
alter table public.prevailing_wage_worker_assignments
  drop constraint if exists prevailing_wage_worker_assignments_classification_company_fkey,
  add constraint prevailing_wage_worker_assignments_classification_company_fkey foreign key (classification_id, company_id) references public.prevailing_wage_classifications(id, company_id) on delete restrict;

alter table public.prevailing_wage_time_entries
  drop constraint if exists prevailing_wage_time_entries_project_company_fkey,
  add constraint prevailing_wage_time_entries_project_company_fkey foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade;
alter table public.prevailing_wage_time_entries
  drop constraint if exists prevailing_wage_time_entries_assignment_company_fkey,
  add constraint prevailing_wage_time_entries_assignment_company_fkey foreign key (worker_assignment_id, company_id) references public.prevailing_wage_worker_assignments(id, company_id) on delete cascade;

alter table public.certified_payroll_periods
  drop constraint if exists certified_payroll_periods_project_company_fkey,
  add constraint certified_payroll_periods_project_company_fkey foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade;

alter table public.certified_payroll_worker_rows
  drop constraint if exists certified_payroll_worker_rows_period_company_fkey,
  add constraint certified_payroll_worker_rows_period_company_fkey foreign key (certified_payroll_period_id, company_id) references public.certified_payroll_periods(id, company_id) on delete cascade;
alter table public.certified_payroll_worker_rows
  drop constraint if exists certified_payroll_worker_rows_assignment_company_fkey,
  add constraint certified_payroll_worker_rows_assignment_company_fkey foreign key (worker_assignment_id, company_id) references public.prevailing_wage_worker_assignments(id, company_id) on delete restrict;
alter table public.certified_payroll_worker_rows
  drop constraint if exists certified_payroll_worker_rows_classification_company_fkey,
  add constraint certified_payroll_worker_rows_classification_company_fkey foreign key (classification_id, company_id) references public.prevailing_wage_classifications(id, company_id) on delete restrict;

create index if not exists idx_vendor_bills_company_status on public.vendor_bills(company_id, status);
create index if not exists idx_vendor_bills_company_vendor on public.vendor_bills(company_id, vendor_id);
create index if not exists idx_vendor_bills_company_project on public.vendor_bills(company_id, project_id);
create index if not exists idx_vendor_bills_due_date on public.vendor_bills(company_id, due_date);
create index if not exists idx_vendor_bill_lines_project_cost_code on public.vendor_bill_line_items(company_id, project_id, cost_code_id);
create index if not exists idx_prevailing_wage_profiles_project on public.prevailing_wage_project_profiles(company_id, project_id);
create index if not exists idx_prevailing_wage_classifications_profile on public.prevailing_wage_classifications(company_id, profile_id, active);
create index if not exists idx_prevailing_wage_assignments_project on public.prevailing_wage_worker_assignments(company_id, project_id, active);
create index if not exists idx_prevailing_wage_time_project_date on public.prevailing_wage_time_entries(company_id, project_id, work_date);
create index if not exists idx_certified_payroll_periods_project_week on public.certified_payroll_periods(company_id, project_id, week_ending_date desc);

-- RLS
alter table public.vendor_bills enable row level security;
alter table public.vendor_bill_line_items enable row level security;
alter table public.vendor_bill_payments enable row level security;
alter table public.prevailing_wage_project_profiles enable row level security;
alter table public.prevailing_wage_classifications enable row level security;
alter table public.prevailing_wage_worker_assignments enable row level security;
alter table public.prevailing_wage_time_entries enable row level security;
alter table public.certified_payroll_periods enable row level security;
alter table public.certified_payroll_worker_rows enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'vendor_bills','vendor_bill_line_items','vendor_bill_payments',
    'prevailing_wage_project_profiles','prevailing_wage_classifications','prevailing_wage_worker_assignments',
    'prevailing_wage_time_entries','certified_payroll_periods','certified_payroll_worker_rows'
  ] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);

    execute format('create policy %I_select on public.%I for select to authenticated using (public.is_company_member(company_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (public.has_company_role(company_id, array[''owner'',''administrator'',''operations_manager'',''office_manager'',''accountant'',''project_manager'',''superintendent'']))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (public.has_company_role(company_id, array[''owner'',''administrator'',''operations_manager'',''office_manager'',''accountant'',''project_manager'',''superintendent''])) with check (public.has_company_role(company_id, array[''owner'',''administrator'',''operations_manager'',''office_manager'',''accountant'',''project_manager'',''superintendent'']))', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.has_company_role(company_id, array[''owner'',''administrator'']))', t, t);
  end loop;
end $$;

commit;

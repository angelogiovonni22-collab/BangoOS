begin;

-- Finance / AP + Prevailing Wage hardening
-- Correct tenant-preserving composite FK delete behavior and expand certified-payroll
-- evidence needed for current federal DBRA / WH-347 and Ohio prevailing-wage workflows.

-- PostgreSQL SET NULL normally nulls every referencing column in a composite FK.
-- company_id is intentionally preserved so tenant identity is never cleared.
alter table public.vendor_bills
  drop constraint if exists vendor_bills_project_company_fkey,
  add constraint vendor_bills_project_company_fkey foreign key (project_id, company_id) references public.projects(id, company_id) on delete set null (project_id);
alter table public.vendor_bills
  drop constraint if exists vendor_bills_purchase_order_company_fkey,
  add constraint vendor_bills_purchase_order_company_fkey foreign key (purchase_order_id, company_id) references public.purchase_orders(id, company_id) on delete set null (purchase_order_id);
alter table public.vendor_bills
  drop constraint if exists vendor_bills_approved_by_company_fkey,
  add constraint vendor_bills_approved_by_company_fkey foreign key (approved_by, company_id) references public.profiles(id, company_id) on delete set null (approved_by);
alter table public.vendor_bills
  drop constraint if exists vendor_bills_voided_by_company_fkey,
  add constraint vendor_bills_voided_by_company_fkey foreign key (voided_by, company_id) references public.profiles(id, company_id) on delete set null (voided_by);
alter table public.vendor_bills
  drop constraint if exists vendor_bills_created_by_company_fkey,
  add constraint vendor_bills_created_by_company_fkey foreign key (created_by, company_id) references public.profiles(id, company_id) on delete set null (created_by);
alter table public.vendor_bills
  drop constraint if exists vendor_bills_updated_by_company_fkey,
  add constraint vendor_bills_updated_by_company_fkey foreign key (updated_by, company_id) references public.profiles(id, company_id) on delete set null (updated_by);

alter table public.vendor_bill_line_items
  drop constraint if exists vendor_bill_line_items_project_company_fkey,
  add constraint vendor_bill_line_items_project_company_fkey foreign key (project_id, company_id) references public.projects(id, company_id) on delete set null (project_id);
alter table public.vendor_bill_line_items
  drop constraint if exists vendor_bill_line_items_cost_code_company_fkey,
  add constraint vendor_bill_line_items_cost_code_company_fkey foreign key (cost_code_id, company_id) references public.cost_codes(id, company_id) on delete set null (cost_code_id);
alter table public.vendor_bill_line_items
  drop constraint if exists vendor_bill_line_items_purchase_order_line_company_fkey,
  add constraint vendor_bill_line_items_purchase_order_line_company_fkey foreign key (purchase_order_line_item_id, company_id) references public.purchase_order_line_items(id, company_id) on delete set null (purchase_order_line_item_id);
alter table public.vendor_bill_line_items
  drop constraint if exists vendor_bill_line_items_created_by_company_fkey,
  add constraint vendor_bill_line_items_created_by_company_fkey foreign key (created_by, company_id) references public.profiles(id, company_id) on delete set null (created_by);
alter table public.vendor_bill_line_items
  drop constraint if exists vendor_bill_line_items_updated_by_company_fkey,
  add constraint vendor_bill_line_items_updated_by_company_fkey foreign key (updated_by, company_id) references public.profiles(id, company_id) on delete set null (updated_by);

alter table public.vendor_bill_payments
  drop constraint if exists vendor_bill_payments_created_by_company_fkey,
  add constraint vendor_bill_payments_created_by_company_fkey foreign key (created_by, company_id) references public.profiles(id, company_id) on delete set null (created_by);

alter table public.prevailing_wage_project_profiles
  drop constraint if exists prevailing_wage_profiles_created_by_company_fkey,
  add constraint prevailing_wage_profiles_created_by_company_fkey foreign key (created_by, company_id) references public.profiles(id, company_id) on delete set null (created_by);
alter table public.prevailing_wage_project_profiles
  drop constraint if exists prevailing_wage_profiles_updated_by_company_fkey,
  add constraint prevailing_wage_profiles_updated_by_company_fkey foreign key (updated_by, company_id) references public.profiles(id, company_id) on delete set null (updated_by);

alter table public.prevailing_wage_classifications
  drop constraint if exists prevailing_wage_classifications_created_by_company_fkey,
  add constraint prevailing_wage_classifications_created_by_company_fkey foreign key (created_by, company_id) references public.profiles(id, company_id) on delete set null (created_by);
alter table public.prevailing_wage_classifications
  drop constraint if exists prevailing_wage_classifications_updated_by_company_fkey,
  add constraint prevailing_wage_classifications_updated_by_company_fkey foreign key (updated_by, company_id) references public.profiles(id, company_id) on delete set null (updated_by);

alter table public.prevailing_wage_worker_assignments
  drop constraint if exists prevailing_wage_worker_assignments_created_by_company_fkey,
  add constraint prevailing_wage_worker_assignments_created_by_company_fkey foreign key (created_by, company_id) references public.profiles(id, company_id) on delete set null (created_by);
alter table public.prevailing_wage_worker_assignments
  drop constraint if exists prevailing_wage_worker_assignments_updated_by_company_fkey,
  add constraint prevailing_wage_worker_assignments_updated_by_company_fkey foreign key (updated_by, company_id) references public.profiles(id, company_id) on delete set null (updated_by);

alter table public.prevailing_wage_time_entries
  drop constraint if exists prevailing_wage_time_entries_source_time_company_fkey,
  add constraint prevailing_wage_time_entries_source_time_company_fkey foreign key (source_time_entry_id, company_id) references public.workforce_time_entries(id, company_id) on delete set null (source_time_entry_id);
alter table public.prevailing_wage_time_entries
  drop constraint if exists prevailing_wage_time_entries_created_by_company_fkey,
  add constraint prevailing_wage_time_entries_created_by_company_fkey foreign key (created_by, company_id) references public.profiles(id, company_id) on delete set null (created_by);
alter table public.prevailing_wage_time_entries
  drop constraint if exists prevailing_wage_time_entries_updated_by_company_fkey,
  add constraint prevailing_wage_time_entries_updated_by_company_fkey foreign key (updated_by, company_id) references public.profiles(id, company_id) on delete set null (updated_by);

alter table public.certified_payroll_periods
  drop constraint if exists certified_payroll_periods_statement_signed_by_company_fkey,
  add constraint certified_payroll_periods_statement_signed_by_company_fkey foreign key (statement_signed_by, company_id) references public.profiles(id, company_id) on delete set null (statement_signed_by);
alter table public.certified_payroll_periods
  drop constraint if exists certified_payroll_periods_submitted_by_company_fkey,
  add constraint certified_payroll_periods_submitted_by_company_fkey foreign key (submitted_by, company_id) references public.profiles(id, company_id) on delete set null (submitted_by);
alter table public.certified_payroll_periods
  drop constraint if exists certified_payroll_periods_created_by_company_fkey,
  add constraint certified_payroll_periods_created_by_company_fkey foreign key (created_by, company_id) references public.profiles(id, company_id) on delete set null (created_by);
alter table public.certified_payroll_periods
  drop constraint if exists certified_payroll_periods_updated_by_company_fkey,
  add constraint certified_payroll_periods_updated_by_company_fkey foreign key (updated_by, company_id) references public.profiles(id, company_id) on delete set null (updated_by);

-- Snapshot the evidence required to produce auditable federal/Ohio certified payrolls.
alter table public.certified_payroll_periods
  add column if not exists final_payroll boolean not null default false,
  add column if not exists contractor_tier text null,
  add column if not exists business_name_snapshot text null,
  add column if not exists business_address_snapshot text null,
  add column if not exists project_name_snapshot text null,
  add column if not exists project_location_snapshot text null,
  add column if not exists contract_number_snapshot text null,
  add column if not exists wage_determination_snapshot text null,
  add column if not exists certifying_official_name text null,
  add column if not exists certifying_official_title text null,
  add column if not exists certifying_official_phone text null,
  add column if not exists certifying_official_email text null,
  add column if not exists statement_signature_method text null,
  add column if not exists statement_signature_reference text null,
  add column if not exists records_retain_until date null;

alter table public.certified_payroll_periods
  drop constraint if exists certified_payroll_periods_contractor_tier_check,
  add constraint certified_payroll_periods_contractor_tier_check check (contractor_tier is null or contractor_tier in ('prime','subcontractor'));

alter table public.certified_payroll_periods
  drop constraint if exists certified_payroll_periods_statement_check,
  add constraint certified_payroll_periods_statement_check check (
    statement_of_compliance_signed = false
    or (
      statement_signed_at is not null
      and statement_signed_by is not null
      and btrim(coalesce(certifying_official_name,'')) <> ''
      and btrim(coalesce(certifying_official_title,'')) <> ''
      and btrim(coalesce(certifying_official_phone,'')) <> ''
      and btrim(coalesce(certifying_official_email,'')) <> ''
      and btrim(coalesce(statement_signature_method,'')) <> ''
      and btrim(coalesce(statement_signature_reference,'')) <> ''
    )
  );

alter table public.certified_payroll_worker_rows
  add column if not exists worker_entry_number integer null,
  add column if not exists worker_address text null,
  add column if not exists worker_ssn_last4 text null,
  add column if not exists worker_status text null,
  add column if not exists apprentice_level_snapshot text null,
  add column if not exists classification_name_snapshot text null,
  add column if not exists daily_hours jsonb not null default '{}'::jsonb,
  add column if not exists overtime_rate_paid numeric(12,4) not null default 0,
  add column if not exists gross_all_work_amount numeric(14,2) not null default 0,
  add column if not exists tax_withholding numeric(14,2) not null default 0,
  add column if not exists fica_withholding numeric(14,2) not null default 0,
  add column if not exists other_deductions numeric(14,2) not null default 0,
  add column if not exists deduction_detail jsonb not null default '[]'::jsonb,
  add column if not exists fringe_benefit_credit_total numeric(14,2) not null default 0,
  add column if not exists cash_in_lieu_fringe_total numeric(14,2) not null default 0,
  add column if not exists fringe_plan_evidence jsonb not null default '[]'::jsonb;

alter table public.certified_payroll_worker_rows
  drop constraint if exists certified_payroll_worker_rows_entry_number_check,
  add constraint certified_payroll_worker_rows_entry_number_check check (worker_entry_number is null or worker_entry_number > 0),
  drop constraint if exists certified_payroll_worker_rows_ssn_last4_check,
  add constraint certified_payroll_worker_rows_ssn_last4_check check (worker_ssn_last4 is null or worker_ssn_last4 ~ '^[0-9]{4}$'),
  drop constraint if exists certified_payroll_worker_rows_worker_status_check,
  add constraint certified_payroll_worker_rows_worker_status_check check (worker_status is null or worker_status in ('journeyworker','registered_apprentice')),
  drop constraint if exists certified_payroll_worker_rows_daily_hours_object_check,
  add constraint certified_payroll_worker_rows_daily_hours_object_check check (jsonb_typeof(daily_hours) = 'object'),
  drop constraint if exists certified_payroll_worker_rows_deduction_detail_array_check,
  add constraint certified_payroll_worker_rows_deduction_detail_array_check check (jsonb_typeof(deduction_detail) = 'array'),
  drop constraint if exists certified_payroll_worker_rows_fringe_plan_evidence_array_check,
  add constraint certified_payroll_worker_rows_fringe_plan_evidence_array_check check (jsonb_typeof(fringe_plan_evidence) = 'array'),
  drop constraint if exists certified_payroll_worker_rows_extended_amounts_check,
  add constraint certified_payroll_worker_rows_extended_amounts_check check (
    overtime_rate_paid >= 0
    and gross_all_work_amount >= 0
    and tax_withholding >= 0
    and fica_withholding >= 0
    and other_deductions >= 0
    and fringe_benefit_credit_total >= 0
    and cash_in_lieu_fringe_total >= 0
  );

-- Wage/payment evidence includes sensitive worker compensation and identifiers.
-- Keep operational access available to approved project leadership, but not every company member.
do $$
declare
  t text;
begin
  foreach t in array array[
    'prevailing_wage_worker_assignments',
    'prevailing_wage_time_entries',
    'certified_payroll_periods',
    'certified_payroll_worker_rows'
  ] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.has_company_role(company_id, array[''owner'',''administrator'',''operations_manager'',''office_manager'',''accountant'',''project_manager'',''superintendent'']))',
      t,
      t
    );
  end loop;
end $$;

commit;

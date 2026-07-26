begin;

-- Sprint 1 additive evolution of public.estimates.
-- Do not drop or recreate the table; preserve existing data.

alter table public.estimates
  add column if not exists version_number integer not null default 1,
  add column if not exists previous_estimate_id uuid null,
  add column if not exists currency_code text not null default 'USD',
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric(14,4) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists internal_cost_total numeric(14,2) not null default 0,
  add column if not exists gross_profit numeric(14,2) not null default 0,
  add column if not exists gross_margin_percent numeric(9,6) not null default 0,
  add column if not exists customer_notes text null,
  add column if not exists internal_notes text null,
  add column if not exists customer_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid null,
  add column if not exists updated_by uuid null,
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null,
  add column if not exists generated_by_ai boolean not null default false,
  add column if not exists ai_context jsonb not null default '{}'::jsonb,
  add column if not exists pdf_snapshot jsonb null;

-- Keep customer_id nullable in this migration for additive safety.
-- Convert to NOT NULL only after explicit data validation/backfill.

alter table public.estimates
  drop constraint if exists estimates_previous_estimate_id_fkey,
  add constraint estimates_previous_estimate_id_fkey
    foreign key (previous_estimate_id)
    references public.estimates(id)
    on delete restrict
    not valid;

alter table public.estimates
  drop constraint if exists estimates_created_by_fkey,
  add constraint estimates_created_by_fkey
    foreign key (created_by)
    references public.profiles(id)
    on delete set null
    not valid;

alter table public.estimates
  drop constraint if exists estimates_updated_by_fkey,
  add constraint estimates_updated_by_fkey
    foreign key (updated_by)
    references public.profiles(id)
    on delete set null
    not valid;

alter table public.estimates
  drop constraint if exists estimates_deleted_by_fkey,
  add constraint estimates_deleted_by_fkey
    foreign key (deleted_by)
    references public.profiles(id)
    on delete set null
    not valid;

create unique index if not exists estimates_id_company_id_key
  on public.estimates(id, company_id);

alter table public.estimates
  drop constraint if exists estimates_version_number_check,
  add constraint estimates_version_number_check
    check (version_number >= 1)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_previous_estimate_not_self_check,
  add constraint estimates_previous_estimate_not_self_check
    check (previous_estimate_id is null or previous_estimate_id <> id)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_discount_value_check,
  add constraint estimates_discount_value_check
    check (discount_value >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_discount_amount_check,
  add constraint estimates_discount_amount_check
    check (discount_amount >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_tax_rate_check,
  -- Canonical convention: tax_rate is stored as a decimal fraction (0.07 = 7%).
  add constraint estimates_tax_rate_check
    check (tax_rate >= 0 and tax_rate <= 1)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_currency_code_check,
  add constraint estimates_currency_code_check
    check (currency_code ~ '^[A-Z]{3}$')
    not valid;

alter table public.estimates
  drop constraint if exists estimates_title_not_blank_check,
  add constraint estimates_title_not_blank_check
    check (btrim(title) <> '')
    not valid;

alter table public.estimates
  drop constraint if exists estimates_number_not_blank_check,
  add constraint estimates_number_not_blank_check
    check (estimate_number is null or btrim(estimate_number) <> '')
    not valid;

alter table public.estimates
  drop constraint if exists estimates_subtotal_check,
  add constraint estimates_subtotal_check
    check (subtotal >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_tax_amount_check,
  add constraint estimates_tax_amount_check
    check (tax_amount >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_total_amount_check,
  add constraint estimates_total_amount_check
    check (total_amount >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_internal_cost_total_check,
  add constraint estimates_internal_cost_total_check
    check (internal_cost_total >= 0)
    not valid;

-- Gross margin percent may be negative to represent unprofitable estimates.
alter table public.estimates
  drop constraint if exists estimates_gross_margin_percent_check,
  add constraint estimates_gross_margin_percent_check
    -- Canonical convention: gross_margin_percent is stored as a whole percentage (25 = 25%).
    check (gross_margin_percent >= -100)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_status_check,
  add constraint estimates_status_check
    check (
      status in (
        'draft',
        'ready',
        'sent',
        'viewed',
        'revision_requested',
        'approved',
        'rejected',
        'expired',
        'void',
        'superseded'
      )
    )
    not valid;

alter table public.estimates
  drop constraint if exists estimates_discount_type_check,
  add constraint estimates_discount_type_check
    check (discount_type in ('percentage', 'fixed', 'none'))
    not valid;

alter table public.estimates
  drop constraint if exists estimates_non_draft_requires_number_check,
  add constraint estimates_non_draft_requires_number_check
    -- PostgreSQL allows multiple NULLs in unique indexes; NULL estimate numbers are allowed only for draft workflow.
    check (status = 'draft' or estimate_number is not null)
    not valid;

create unique index if not exists idx_estimates_company_number_version_unique
  on public.estimates(company_id, estimate_number, version_number);

create index if not exists idx_estimates_company_updated_at_active
  on public.estimates(company_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_estimates_company_status_updated_at_active
  on public.estimates(company_id, status, updated_at desc)
  where deleted_at is null;

create index if not exists idx_estimates_company_customer_updated_at_active_partial
  on public.estimates(company_id, customer_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_estimates_company_project_updated_at_active_partial
  on public.estimates(company_id, project_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_estimates_previous_estimate_id
  on public.estimates(previous_estimate_id);

-- JSONB index intentionally deferred for Sprint 1.
-- Add GIN on ai_context later when Atlas/source query patterns are confirmed.

commit;

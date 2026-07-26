begin;

create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  -- Composite ownership integrity: item must belong to an estimate in the same company.
  estimate_id uuid not null,
  -- Composite parent integrity: section must belong to the same estimate and company.
  section_id uuid not null,
  item_type text not null default 'custom',
  name text not null,
  description text null,
  sort_order integer not null default 1000,
  quantity numeric(12,3) not null default 1,
  unit text null,
  material_cost numeric(14,2) not null default 0,
  labor_hours numeric(12,3) not null default 0,
  labor_rate numeric(14,4) not null default 0,
  labor_cost numeric(14,2) not null default 0,
  equipment_cost numeric(14,2) not null default 0,
  subcontractor_cost numeric(14,2) not null default 0,
  other_cost numeric(14,2) not null default 0,
  internal_cost_total numeric(14,2) not null default 0,
  -- Canonical convention: markup_value for percentage markup is a whole percentage (25 = 25%).
  markup_type text not null default 'none',
  markup_value numeric(14,4) not null default 0,
  customer_unit_price numeric(14,2) not null default 0,
  customer_line_total numeric(14,2) not null default 0,
  taxable boolean not null default true,
  customer_visible boolean not null default true,
  customer_description text null,
  source_type text null,
  source_reference jsonb null,
  generated_by_ai boolean not null default false,
  ai_context jsonb not null default '{}'::jsonb,
  converted_task_id uuid null references public.tasks(id) on delete set null,
  deleted_at timestamptz null,
  deleted_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint estimate_items_item_type_check
    check (
      item_type in (
        'custom',
        'material',
        'labor',
        'equipment',
        'subcontractor',
        'allowance',
        'fee',
        'discount'
      )
    ),

  constraint estimate_items_markup_type_check
    check (markup_type in ('percentage', 'fixed', 'none')),

  constraint estimate_items_sort_order_check
    check (sort_order >= 0),

  constraint estimate_items_name_not_blank_check
    check (btrim(name) <> ''),

  constraint estimate_items_quantity_check
    check (quantity >= 0),

  constraint estimate_items_material_cost_check
    check (material_cost >= 0),

  constraint estimate_items_labor_hours_check
    check (labor_hours >= 0),

  constraint estimate_items_labor_rate_check
    check (labor_rate >= 0),

  constraint estimate_items_labor_cost_check
    check (labor_cost >= 0),

  constraint estimate_items_equipment_cost_check
    check (equipment_cost >= 0),

  constraint estimate_items_subcontractor_cost_check
    check (subcontractor_cost >= 0),

  constraint estimate_items_other_cost_check
    check (other_cost >= 0),

  constraint estimate_items_internal_cost_total_check
    check (internal_cost_total >= 0),

  constraint estimate_items_markup_value_check
    check (markup_value >= 0),

  constraint estimate_items_customer_unit_price_check
    check (customer_unit_price >= 0),

  constraint estimate_items_customer_line_total_check
    check (
      (item_type = 'discount' and customer_line_total <= 0)
      or (item_type <> 'discount' and customer_line_total >= 0)
    ),

  constraint estimate_items_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade,

  constraint estimate_items_section_estimate_company_fkey
    foreign key (section_id, estimate_id, company_id)
    references public.estimate_sections(id, estimate_id, company_id)
    on delete cascade
);

alter table public.estimate_items
  drop constraint if exists estimate_items_name_not_blank_check,
  add constraint estimate_items_name_not_blank_check
    check (btrim(name) <> '');

alter table public.estimate_items
  drop constraint if exists estimate_items_estimate_company_fkey,
  add constraint estimate_items_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade;

alter table public.estimate_items
  drop constraint if exists estimate_items_section_estimate_company_fkey,
  add constraint estimate_items_section_estimate_company_fkey
    foreign key (section_id, estimate_id, company_id)
    references public.estimate_sections(id, estimate_id, company_id)
    on delete cascade;

create index if not exists idx_estimate_items_section_sort_order_active
  on public.estimate_items(section_id, sort_order)
  where deleted_at is null;

create index if not exists idx_estimate_items_estimate_section_sort_order_active
  on public.estimate_items(estimate_id, section_id, sort_order)
  where deleted_at is null;

create index if not exists idx_estimate_items_section_deleted_at
  on public.estimate_items(section_id, deleted_at);

create index if not exists idx_estimate_items_estimate_deleted_at
  on public.estimate_items(estimate_id, deleted_at);

create index if not exists idx_estimate_items_company_item_type
  on public.estimate_items(company_id, item_type);

-- JSONB indexes intentionally deferred for Sprint 1.
-- Add GIN on ai_context/source_reference later when Atlas/source query patterns are confirmed.

commit;

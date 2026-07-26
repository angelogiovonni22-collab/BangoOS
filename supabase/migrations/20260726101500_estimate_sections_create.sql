begin;

create table if not exists public.estimate_sections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  -- Composite ownership integrity: estimate must belong to the same company.
  estimate_id uuid not null,
  name text not null,
  description text null,
  sort_order integer not null default 1000,
  customer_visible boolean not null default true,
  section_subtotal numeric(14,2) not null default 0,
  section_internal_cost numeric(14,2) not null default 0,
  deleted_at timestamptz null,
  deleted_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint estimate_sections_sort_order_check
    check (sort_order >= 0),

  constraint estimate_sections_name_not_blank_check
    check (btrim(name) <> ''),

  constraint estimate_sections_section_subtotal_check
    check (section_subtotal >= 0),

  constraint estimate_sections_section_internal_cost_check
    check (section_internal_cost >= 0),

  constraint estimate_sections_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade
);

alter table public.estimate_sections
  drop constraint if exists estimate_sections_name_not_blank_check,
  add constraint estimate_sections_name_not_blank_check
    check (btrim(name) <> '');

alter table public.estimate_sections
  drop constraint if exists estimate_sections_estimate_company_fkey,
  add constraint estimate_sections_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade;

create unique index if not exists estimate_sections_id_estimate_company_key
  on public.estimate_sections(id, estimate_id, company_id);

create index if not exists idx_estimate_sections_company_estimate
  on public.estimate_sections(company_id, estimate_id);

create index if not exists idx_estimate_sections_estimate_sort_order
  on public.estimate_sections(estimate_id, sort_order);

create index if not exists idx_estimate_sections_estimate_sort_order_active
  on public.estimate_sections(estimate_id, sort_order)
  where deleted_at is null;

create index if not exists idx_estimate_sections_estimate_deleted_at
  on public.estimate_sections(estimate_id, deleted_at);

create index if not exists idx_estimate_sections_company_deleted_at
  on public.estimate_sections(company_id, deleted_at);

commit;

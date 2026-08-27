create table if not exists public.procurement_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  project_id uuid,
  supplier_id uuid,
  status text not null default 'requested' check (status in ('requested','approved','ordered','confirmed','ready','partially_received','received','cancelled')),
  estimated_material_cost numeric(14,2) not null default 0,
  committed_cost numeric(14,2) not null default 0,
  delivery_cost numeric(14,2) not null default 0,
  approved_by uuid,
  approved_at timestamptz,
  budget_confirmed boolean not null default false,
  supplier_order_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.procurement_order_lines (
  id uuid primary key default gen_random_uuid(),
  procurement_order_id uuid not null references public.procurement_orders(id) on delete cascade,
  description text not null,
  sku text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,4) not null default 0,
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.procurement_receipts (
  id uuid primary key default gen_random_uuid(),
  procurement_order_id uuid not null references public.procurement_orders(id) on delete cascade,
  received_by uuid,
  received_at timestamptz not null default now(),
  notes text,
  evidence_path text,
  created_at timestamptz not null default now()
);

create index if not exists procurement_orders_company_project_idx on public.procurement_orders(company_id, project_id, created_at desc);
create index if not exists procurement_order_lines_order_idx on public.procurement_order_lines(procurement_order_id);
create index if not exists procurement_receipts_order_idx on public.procurement_receipts(procurement_order_id, received_at desc);

alter table public.procurement_orders enable row level security;
alter table public.procurement_order_lines enable row level security;
alter table public.procurement_receipts enable row level security;

comment on table public.procurement_orders is 'Supplier-independent B.O.S. material procurement lifecycle. Electronic submission remains gated by application-level explicit approval and supplier authorization.';

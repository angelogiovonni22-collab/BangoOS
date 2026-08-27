create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, name text not null,
  location_type text not null default 'warehouse' check (location_type in ('warehouse','vehicle','jobsite','other')),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.inventory_balances (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  material_id uuid not null references public.materials(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete cascade,
  on_hand numeric(14,3) not null default 0 check (on_hand >= 0), reserved numeric(14,3) not null default 0 check (reserved >= 0),
  unit_cost numeric(14,4) not null default 0, updated_at timestamptz not null default now(), unique(material_id, location_id)
);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  material_id uuid not null references public.materials(id), location_id uuid not null references public.inventory_locations(id),
  project_id uuid, movement_type text not null check (movement_type in ('receive','allocate','consume','return','transfer','adjust')),
  quantity numeric(14,3) not null, unit_cost numeric(14,4), reference_type text, reference_id uuid,
  reason text, created_by uuid, created_at timestamptz not null default now()
);
create index if not exists inventory_balances_company_location_idx on public.inventory_balances(company_id, location_id);
create index if not exists inventory_movements_company_material_idx on public.inventory_movements(company_id, material_id, created_at desc);
alter table public.inventory_locations enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
comment on table public.inventory_movements is 'Immutable B.O.S. inventory ledger for receiving, project allocation, consumption, returns, transfers and audited adjustments.';

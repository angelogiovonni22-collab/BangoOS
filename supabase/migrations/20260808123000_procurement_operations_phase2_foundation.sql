begin;

-- Ensure composite keys needed for strict company-scoped foreign keys.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'materials_id_company_unique'
  ) then
    alter table public.materials
      add constraint materials_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_id_company_unique'
  ) then
    alter table public.projects
      add constraint projects_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendors_id_company_unique'
  ) then
    alter table public.vendors
      add constraint vendors_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cost_codes_id_company_unique'
  ) then
    alter table public.cost_codes
      add constraint cost_codes_id_company_unique unique (id, company_id);
  end if;
end $$;

create table if not exists public.material_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_number text not null,
  project_id uuid not null,
  priority text not null default 'normal',
  status text not null default 'draft',
  needed_by_date date null,
  notes text null,
  attachments jsonb not null default '[]'::jsonb,
  requested_by uuid null,
  approved_by uuid null,
  converted_purchase_order_id uuid null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint material_requests_request_number_not_blank_check check (btrim(request_number) <> ''),
  constraint material_requests_priority_check check (priority in ('low', 'normal', 'high', 'critical')),
  constraint material_requests_status_check check (status in ('draft', 'submitted', 'approved', 'rejected', 'converted', 'cancelled')),
  constraint material_requests_attachments_array_check check (jsonb_typeof(attachments) = 'array')
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  po_number text not null,
  request_id uuid null,
  vendor_id uuid not null,
  project_id uuid not null,
  cost_code_id uuid null,
  status text not null default 'draft',
  subtotal_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  shipping_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  notes text null,
  attachments jsonb not null default '[]'::jsonb,
  approved_at timestamptz null,
  approved_by uuid null,
  issued_at timestamptz null,
  issued_by uuid null,
  cancelled_at timestamptz null,
  cancelled_by uuid null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_orders_po_number_not_blank_check check (btrim(po_number) <> ''),
  constraint purchase_orders_status_check check (status in ('draft', 'approved', 'issued', 'partially_received', 'fully_received', 'cancelled')),
  constraint purchase_orders_subtotal_amount_non_negative_check check (subtotal_amount >= 0),
  constraint purchase_orders_tax_amount_non_negative_check check (tax_amount >= 0),
  constraint purchase_orders_shipping_amount_non_negative_check check (shipping_amount >= 0),
  constraint purchase_orders_total_amount_non_negative_check check (total_amount >= 0),
  constraint purchase_orders_attachments_array_check check (jsonb_typeof(attachments) = 'array')
);

create table if not exists public.purchase_order_line_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null,
  material_id uuid null,
  description text not null,
  quantity_ordered numeric(14,3) not null,
  quantity_received numeric(14,3) not null default 0,
  quantity_damaged numeric(14,3) not null default 0,
  quantity_backordered numeric(14,3) not null default 0,
  unit_cost numeric(14,4) not null,
  line_subtotal numeric(14,2) not null,
  project_id uuid not null,
  cost_code_id uuid null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_order_line_items_description_not_blank_check check (btrim(description) <> ''),
  constraint purchase_order_line_items_quantity_ordered_positive_check check (quantity_ordered > 0),
  constraint purchase_order_line_items_quantity_received_non_negative_check check (quantity_received >= 0),
  constraint purchase_order_line_items_quantity_damaged_non_negative_check check (quantity_damaged >= 0),
  constraint purchase_order_line_items_quantity_backordered_non_negative_check check (quantity_backordered >= 0),
  constraint purchase_order_line_items_unit_cost_non_negative_check check (unit_cost >= 0),
  constraint purchase_order_line_items_line_subtotal_non_negative_check check (line_subtotal >= 0),
  constraint purchase_order_line_items_received_not_over_ordered_check check (quantity_received + quantity_damaged <= quantity_ordered)
);

create table if not exists public.purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null,
  received_date date not null,
  notes text null,
  attachments jsonb not null default '[]'::jsonb,
  received_by uuid null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_order_receipts_attachments_array_check check (jsonb_typeof(attachments) = 'array')
);

create table if not exists public.project_material_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null,
  purchase_order_line_item_id uuid not null,
  material_id uuid not null,
  project_id uuid not null,
  cost_code_id uuid null,
  quantity_allocated numeric(14,3) not null,
  unit_cost numeric(14,4) not null,
  total_cost numeric(14,2) not null,
  notes text null,
  allocated_at timestamptz not null default now(),
  allocated_by uuid null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_material_allocations_quantity_positive_check check (quantity_allocated > 0),
  constraint project_material_allocations_unit_cost_non_negative_check check (unit_cost >= 0),
  constraint project_material_allocations_total_cost_non_negative_check check (total_cost >= 0)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_requests_id_company_unique'
  ) then
    alter table public.material_requests
      add constraint material_requests_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_orders_id_company_unique'
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_order_line_items_id_company_unique'
  ) then
    alter table public.purchase_order_line_items
      add constraint purchase_order_line_items_id_company_unique unique (id, company_id);
  end if;
end $$;

-- Foreign keys for strict company-scoped links.
alter table public.material_requests
  drop constraint if exists material_requests_project_company_fkey,
  add constraint material_requests_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.material_requests
  drop constraint if exists material_requests_requested_by_company_fkey,
  add constraint material_requests_requested_by_company_fkey
    foreign key (requested_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.material_requests
  drop constraint if exists material_requests_approved_by_company_fkey,
  add constraint material_requests_approved_by_company_fkey
    foreign key (approved_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.material_requests
  drop constraint if exists material_requests_created_by_company_fkey,
  add constraint material_requests_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.material_requests
  drop constraint if exists material_requests_updated_by_company_fkey,
  add constraint material_requests_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_vendor_company_fkey,
  add constraint purchase_orders_vendor_company_fkey
    foreign key (vendor_id, company_id)
    references public.vendors(id, company_id)
    on delete restrict;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_project_company_fkey,
  add constraint purchase_orders_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_cost_code_company_fkey,
  add constraint purchase_orders_cost_code_company_fkey
    foreign key (cost_code_id, company_id)
    references public.cost_codes(id, company_id)
    on delete set null;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_request_company_fkey,
  add constraint purchase_orders_request_company_fkey
    foreign key (request_id, company_id)
    references public.material_requests(id, company_id)
    on delete set null;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_approved_by_company_fkey,
  add constraint purchase_orders_approved_by_company_fkey
    foreign key (approved_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_issued_by_company_fkey,
  add constraint purchase_orders_issued_by_company_fkey
    foreign key (issued_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_cancelled_by_company_fkey,
  add constraint purchase_orders_cancelled_by_company_fkey
    foreign key (cancelled_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_created_by_company_fkey,
  add constraint purchase_orders_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_updated_by_company_fkey,
  add constraint purchase_orders_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_order_line_items
  drop constraint if exists purchase_order_line_items_purchase_order_company_fkey,
  add constraint purchase_order_line_items_purchase_order_company_fkey
    foreign key (purchase_order_id, company_id)
    references public.purchase_orders(id, company_id)
    on delete cascade;

alter table public.purchase_order_line_items
  drop constraint if exists purchase_order_line_items_material_company_fkey,
  add constraint purchase_order_line_items_material_company_fkey
    foreign key (material_id, company_id)
    references public.materials(id, company_id)
    on delete set null;

alter table public.purchase_order_line_items
  drop constraint if exists purchase_order_line_items_project_company_fkey,
  add constraint purchase_order_line_items_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.purchase_order_line_items
  drop constraint if exists purchase_order_line_items_cost_code_company_fkey,
  add constraint purchase_order_line_items_cost_code_company_fkey
    foreign key (cost_code_id, company_id)
    references public.cost_codes(id, company_id)
    on delete set null;

alter table public.purchase_order_line_items
  drop constraint if exists purchase_order_line_items_created_by_company_fkey,
  add constraint purchase_order_line_items_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_order_line_items
  drop constraint if exists purchase_order_line_items_updated_by_company_fkey,
  add constraint purchase_order_line_items_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_order_receipts
  drop constraint if exists purchase_order_receipts_purchase_order_company_fkey,
  add constraint purchase_order_receipts_purchase_order_company_fkey
    foreign key (purchase_order_id, company_id)
    references public.purchase_orders(id, company_id)
    on delete cascade;

alter table public.purchase_order_receipts
  drop constraint if exists purchase_order_receipts_received_by_company_fkey,
  add constraint purchase_order_receipts_received_by_company_fkey
    foreign key (received_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_order_receipts
  drop constraint if exists purchase_order_receipts_created_by_company_fkey,
  add constraint purchase_order_receipts_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.purchase_order_receipts
  drop constraint if exists purchase_order_receipts_updated_by_company_fkey,
  add constraint purchase_order_receipts_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_material_allocations
  drop constraint if exists project_material_allocations_purchase_order_company_fkey,
  add constraint project_material_allocations_purchase_order_company_fkey
    foreign key (purchase_order_id, company_id)
    references public.purchase_orders(id, company_id)
    on delete cascade;

alter table public.project_material_allocations
  drop constraint if exists project_material_allocations_line_item_company_fkey,
  add constraint project_material_allocations_line_item_company_fkey
    foreign key (purchase_order_line_item_id, company_id)
    references public.purchase_order_line_items(id, company_id)
    on delete cascade;

alter table public.project_material_allocations
  drop constraint if exists project_material_allocations_material_company_fkey,
  add constraint project_material_allocations_material_company_fkey
    foreign key (material_id, company_id)
    references public.materials(id, company_id)
    on delete restrict;

alter table public.project_material_allocations
  drop constraint if exists project_material_allocations_project_company_fkey,
  add constraint project_material_allocations_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.project_material_allocations
  drop constraint if exists project_material_allocations_cost_code_company_fkey,
  add constraint project_material_allocations_cost_code_company_fkey
    foreign key (cost_code_id, company_id)
    references public.cost_codes(id, company_id)
    on delete set null;

alter table public.project_material_allocations
  drop constraint if exists project_material_allocations_allocated_by_company_fkey,
  add constraint project_material_allocations_allocated_by_company_fkey
    foreign key (allocated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_material_allocations
  drop constraint if exists project_material_allocations_created_by_company_fkey,
  add constraint project_material_allocations_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_material_allocations
  drop constraint if exists project_material_allocations_updated_by_company_fkey,
  add constraint project_material_allocations_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.material_requests
  drop constraint if exists material_requests_converted_purchase_order_company_fkey,
  add constraint material_requests_converted_purchase_order_company_fkey
    foreign key (converted_purchase_order_id, company_id)
    references public.purchase_orders(id, company_id)
    on delete set null;

create unique index if not exists idx_material_requests_company_request_number
  on public.material_requests(company_id, request_number);

create unique index if not exists idx_purchase_orders_company_po_number
  on public.purchase_orders(company_id, po_number);

create index if not exists idx_material_requests_company_project_status
  on public.material_requests(company_id, project_id, status);

create index if not exists idx_purchase_orders_company_vendor_status
  on public.purchase_orders(company_id, vendor_id, status);

create index if not exists idx_purchase_orders_company_project_status
  on public.purchase_orders(company_id, project_id, status);

create index if not exists idx_purchase_order_line_items_company_po
  on public.purchase_order_line_items(company_id, purchase_order_id);

create index if not exists idx_purchase_order_line_items_company_project
  on public.purchase_order_line_items(company_id, project_id);

create index if not exists idx_purchase_order_receipts_company_po
  on public.purchase_order_receipts(company_id, purchase_order_id);

create index if not exists idx_project_material_allocations_company_project
  on public.project_material_allocations(company_id, project_id);

create index if not exists idx_project_material_allocations_company_cost_code
  on public.project_material_allocations(company_id, cost_code_id);

alter table public.material_requests enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_line_items enable row level security;
alter table public.purchase_order_receipts enable row level security;
alter table public.project_material_allocations enable row level security;

drop policy if exists material_requests_select on public.material_requests;
drop policy if exists material_requests_insert on public.material_requests;
drop policy if exists material_requests_update on public.material_requests;
drop policy if exists material_requests_delete on public.material_requests;

create policy material_requests_select
on public.material_requests
for select
to authenticated
using (
  public.is_company_member(material_requests.company_id)
);

create policy material_requests_insert
on public.material_requests
for insert
to authenticated
with check (
  public.has_company_role(
    material_requests.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy material_requests_update
on public.material_requests
for update
to authenticated
using (
  public.has_company_role(
    material_requests.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
)
with check (
  public.has_company_role(
    material_requests.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy material_requests_delete
on public.material_requests
for delete
to authenticated
using (
  public.has_company_role(material_requests.company_id, array['owner', 'administrator'])
);

drop policy if exists purchase_orders_select on public.purchase_orders;
drop policy if exists purchase_orders_insert on public.purchase_orders;
drop policy if exists purchase_orders_update on public.purchase_orders;
drop policy if exists purchase_orders_delete on public.purchase_orders;

create policy purchase_orders_select
on public.purchase_orders
for select
to authenticated
using (
  public.is_company_member(purchase_orders.company_id)
);

create policy purchase_orders_insert
on public.purchase_orders
for insert
to authenticated
with check (
  public.has_company_role(
    purchase_orders.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy purchase_orders_update
on public.purchase_orders
for update
to authenticated
using (
  public.has_company_role(
    purchase_orders.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
)
with check (
  public.has_company_role(
    purchase_orders.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy purchase_orders_delete
on public.purchase_orders
for delete
to authenticated
using (
  public.has_company_role(purchase_orders.company_id, array['owner', 'administrator'])
);

drop policy if exists purchase_order_line_items_select on public.purchase_order_line_items;
drop policy if exists purchase_order_line_items_insert on public.purchase_order_line_items;
drop policy if exists purchase_order_line_items_update on public.purchase_order_line_items;
drop policy if exists purchase_order_line_items_delete on public.purchase_order_line_items;

create policy purchase_order_line_items_select
on public.purchase_order_line_items
for select
to authenticated
using (
  public.is_company_member(purchase_order_line_items.company_id)
);

create policy purchase_order_line_items_insert
on public.purchase_order_line_items
for insert
to authenticated
with check (
  public.has_company_role(
    purchase_order_line_items.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy purchase_order_line_items_update
on public.purchase_order_line_items
for update
to authenticated
using (
  public.has_company_role(
    purchase_order_line_items.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
)
with check (
  public.has_company_role(
    purchase_order_line_items.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy purchase_order_line_items_delete
on public.purchase_order_line_items
for delete
to authenticated
using (
  public.has_company_role(purchase_order_line_items.company_id, array['owner', 'administrator'])
);

drop policy if exists purchase_order_receipts_select on public.purchase_order_receipts;
drop policy if exists purchase_order_receipts_insert on public.purchase_order_receipts;
drop policy if exists purchase_order_receipts_update on public.purchase_order_receipts;
drop policy if exists purchase_order_receipts_delete on public.purchase_order_receipts;

create policy purchase_order_receipts_select
on public.purchase_order_receipts
for select
to authenticated
using (
  public.is_company_member(purchase_order_receipts.company_id)
);

create policy purchase_order_receipts_insert
on public.purchase_order_receipts
for insert
to authenticated
with check (
  public.has_company_role(
    purchase_order_receipts.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy purchase_order_receipts_update
on public.purchase_order_receipts
for update
to authenticated
using (
  public.has_company_role(
    purchase_order_receipts.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
)
with check (
  public.has_company_role(
    purchase_order_receipts.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy purchase_order_receipts_delete
on public.purchase_order_receipts
for delete
to authenticated
using (
  public.has_company_role(purchase_order_receipts.company_id, array['owner', 'administrator'])
);

drop policy if exists project_material_allocations_select on public.project_material_allocations;
drop policy if exists project_material_allocations_insert on public.project_material_allocations;
drop policy if exists project_material_allocations_update on public.project_material_allocations;
drop policy if exists project_material_allocations_delete on public.project_material_allocations;

create policy project_material_allocations_select
on public.project_material_allocations
for select
to authenticated
using (
  public.is_company_member(project_material_allocations.company_id)
);

create policy project_material_allocations_insert
on public.project_material_allocations
for insert
to authenticated
with check (
  public.has_company_role(
    project_material_allocations.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy project_material_allocations_update
on public.project_material_allocations
for update
to authenticated
using (
  public.has_company_role(
    project_material_allocations.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
)
with check (
  public.has_company_role(
    project_material_allocations.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant']
  )
);

create policy project_material_allocations_delete
on public.project_material_allocations
for delete
to authenticated
using (
  public.has_company_role(project_material_allocations.company_id, array['owner', 'administrator'])
);

do $$
declare
  v_updated_at_fn regprocedure;
begin
  select p.oid::regprocedure
    into v_updated_at_fn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_attribute a
    on a.attrelid = c.oid
   and a.attname = 'updated_at'
  where n.nspname = 'public'
    and c.relname in (
      'companies',
      'customers',
      'profiles',
      'projects',
      'vendors',
      'materials',
      'cost_codes'
    )
    and not t.tgisinternal
  order by c.relname, t.tgname
  limit 1;

  if v_updated_at_fn is null then
    raise exception 'No updated_at trigger function found to reuse.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'material_requests'
      and t.tgname = 'trg_material_requests_set_updated_at'
  ) then
    execute format(
      'create trigger trg_material_requests_set_updated_at before update on public.material_requests for each row execute function %s;',
      v_updated_at_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'purchase_orders'
      and t.tgname = 'trg_purchase_orders_set_updated_at'
  ) then
    execute format(
      'create trigger trg_purchase_orders_set_updated_at before update on public.purchase_orders for each row execute function %s;',
      v_updated_at_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'purchase_order_line_items'
      and t.tgname = 'trg_purchase_order_line_items_set_updated_at'
  ) then
    execute format(
      'create trigger trg_purchase_order_line_items_set_updated_at before update on public.purchase_order_line_items for each row execute function %s;',
      v_updated_at_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'purchase_order_receipts'
      and t.tgname = 'trg_purchase_order_receipts_set_updated_at'
  ) then
    execute format(
      'create trigger trg_purchase_order_receipts_set_updated_at before update on public.purchase_order_receipts for each row execute function %s;',
      v_updated_at_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'project_material_allocations'
      and t.tgname = 'trg_project_material_allocations_set_updated_at'
  ) then
    execute format(
      'create trigger trg_project_material_allocations_set_updated_at before update on public.project_material_allocations for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;

begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'estimate_line_items_id_company_unique'
  ) then
    alter table public.estimate_line_items
      add constraint estimate_line_items_id_company_unique unique (id, company_id);
  end if;
end $$;

create table if not exists public.project_material_plan_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  estimate_id uuid null,
  estimate_line_item_id uuid null,
  material_id uuid null,
  selected_vendor_id uuid null,
  selected_supplier_price_entry_id uuid null,
  description text not null,
  item_code text null,
  unit_of_measure text not null default 'each',
  estimated_quantity numeric(14,4) not null,
  inventory_quantity numeric(14,4) not null default 0,
  original_unit_cost numeric(14,4) not null default 0,
  current_unit_cost numeric(14,4) null,
  required_on date null,
  status text not null default 'planned',
  notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_material_plan_description_not_blank check (btrim(description) <> ''),
  constraint project_material_plan_unit_not_blank check (btrim(unit_of_measure) <> ''),
  constraint project_material_plan_estimated_quantity_positive check (estimated_quantity > 0),
  constraint project_material_plan_inventory_quantity_non_negative check (inventory_quantity >= 0),
  constraint project_material_plan_inventory_within_estimate check (inventory_quantity <= estimated_quantity),
  constraint project_material_plan_costs_non_negative check (
    original_unit_cost >= 0 and (current_unit_cost is null or current_unit_cost >= 0)
  ),
  constraint project_material_plan_status_check check (
    status in ('planned', 'ready_to_order', 'partially_ordered', 'ordered', 'partially_received', 'received', 'cancelled')
  ),
  constraint project_material_plan_project_company_fkey foreign key (project_id, company_id)
    references public.projects(id, company_id) on delete cascade,
  constraint project_material_plan_estimate_company_fkey foreign key (estimate_id, company_id)
    references public.estimates(id, company_id) on delete set null (estimate_id),
  constraint project_material_plan_estimate_line_company_fkey foreign key (estimate_line_item_id, company_id)
    references public.estimate_line_items(id, company_id) on delete set null (estimate_line_item_id),
  constraint project_material_plan_material_company_fkey foreign key (material_id, company_id)
    references public.materials(id, company_id) on delete set null (material_id),
  constraint project_material_plan_vendor_company_fkey foreign key (selected_vendor_id, company_id)
    references public.vendors(id, company_id) on delete set null (selected_vendor_id),
  constraint project_material_plan_supplier_entry_company_fkey foreign key (selected_supplier_price_entry_id, company_id)
    references public.supplier_price_entries(id, company_id) on delete set null (selected_supplier_price_entry_id)
);

alter table public.project_material_plan_items
  add constraint project_material_plan_items_id_company_unique unique (id, company_id);

create unique index if not exists idx_project_material_plan_estimate_line
  on public.project_material_plan_items(project_id, estimate_line_item_id)
  where estimate_line_item_id is not null;
create index if not exists idx_project_material_plan_company_project_status
  on public.project_material_plan_items(company_id, project_id, status);
create index if not exists idx_project_material_plan_project_company
  on public.project_material_plan_items(project_id, company_id);
create index if not exists idx_project_material_plan_estimate_company
  on public.project_material_plan_items(estimate_id, company_id) where estimate_id is not null;
create index if not exists idx_project_material_plan_estimate_line_company
  on public.project_material_plan_items(estimate_line_item_id, company_id) where estimate_line_item_id is not null;
create index if not exists idx_project_material_plan_material_company
  on public.project_material_plan_items(material_id, company_id) where material_id is not null;
create index if not exists idx_project_material_plan_vendor_company
  on public.project_material_plan_items(selected_vendor_id, company_id) where selected_vendor_id is not null;
create index if not exists idx_project_material_plan_supplier_entry_company
  on public.project_material_plan_items(selected_supplier_price_entry_id, company_id) where selected_supplier_price_entry_id is not null;

alter table public.purchase_order_line_items
  add column if not exists project_material_plan_item_id uuid null;

alter table public.purchase_order_line_items
  add constraint purchase_order_lines_plan_item_company_fkey
  foreign key (project_material_plan_item_id, company_id)
  references public.project_material_plan_items(id, company_id)
  on delete set null (project_material_plan_item_id);

create index if not exists idx_purchase_order_lines_plan_item_company
  on public.purchase_order_line_items(project_material_plan_item_id, company_id)
  where project_material_plan_item_id is not null;

alter table public.project_material_plan_items enable row level security;

create policy project_material_plan_items_select on public.project_material_plan_items
  for select to authenticated
  using (public.is_company_member(company_id));

create policy project_material_plan_items_insert on public.project_material_plan_items
  for insert to authenticated
  with check (
    public.has_company_role(
      company_id,
      array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant', 'estimator']
    )
    and (created_by is null or created_by = (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy project_material_plan_items_update on public.project_material_plan_items
  for update to authenticated
  using (
    public.has_company_role(
      company_id,
      array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant', 'estimator']
    )
  )
  with check (
    public.has_company_role(
      company_id,
      array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager', 'accountant', 'estimator']
    )
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy project_material_plan_items_delete on public.project_material_plan_items
  for delete to authenticated
  using (public.has_company_role(company_id, array['owner', 'administrator']));

create or replace function public.bootstrap_project_material_plan()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status <> 'completed' or new.project_id is null then
    return new;
  end if;

  insert into public.project_material_plan_items (
    company_id,
    project_id,
    estimate_id,
    estimate_line_item_id,
    material_id,
    selected_vendor_id,
    selected_supplier_price_entry_id,
    description,
    item_code,
    unit_of_measure,
    estimated_quantity,
    original_unit_cost,
    current_unit_cost,
    status,
    created_by,
    updated_by
  )
  select
    item.company_id,
    new.project_id,
    item.estimate_id,
    item.id,
    item.material_id,
    item.supplier_vendor_id,
    item.supplier_price_entry_id,
    item.description,
    item.item_code,
    item.unit,
    item.quantity,
    coalesce(item.supplier_unit_cost_snapshot, item.unit_cost, 0),
    item.unit_cost,
    'planned',
    new.converted_by,
    new.converted_by
  from public.estimate_line_items item
  where item.company_id = new.company_id
    and item.estimate_id = new.estimate_id
    and item.category = 'materials'
    and item.quantity > 0
  on conflict (project_id, estimate_line_item_id)
    where estimate_line_item_id is not null
  do nothing;

  return new;
end;
$$;

drop trigger if exists trg_bootstrap_project_material_plan on public.estimate_project_conversions;
create trigger trg_bootstrap_project_material_plan
after insert or update of status, project_id
on public.estimate_project_conversions
for each row
when (new.status = 'completed' and new.project_id is not null)
execute function public.bootstrap_project_material_plan();

insert into public.project_material_plan_items (
  company_id, project_id, estimate_id, estimate_line_item_id, material_id,
  selected_vendor_id, selected_supplier_price_entry_id, description, item_code,
  unit_of_measure, estimated_quantity, original_unit_cost, current_unit_cost,
  status, created_by, updated_by
)
select
  item.company_id, conversion.project_id, item.estimate_id, item.id, item.material_id,
  item.supplier_vendor_id, item.supplier_price_entry_id, item.description, item.item_code,
  item.unit, item.quantity, coalesce(item.supplier_unit_cost_snapshot, item.unit_cost, 0),
  item.unit_cost, 'planned', conversion.converted_by, conversion.converted_by
from public.estimate_project_conversions conversion
join public.estimate_line_items item
  on item.company_id = conversion.company_id and item.estimate_id = conversion.estimate_id
where conversion.status = 'completed'
  and conversion.project_id is not null
  and item.category = 'materials'
  and item.quantity > 0
on conflict (project_id, estimate_line_item_id)
  where estimate_line_item_id is not null
do nothing;

comment on table public.project_material_plan_items is
  'Approved estimate material snapshots transferred to project procurement planning without changing the quoted cost basis.';
comment on column public.project_material_plan_items.original_unit_cost is
  'Immutable estimate-time unit cost used for procurement variance reporting.';

commit;

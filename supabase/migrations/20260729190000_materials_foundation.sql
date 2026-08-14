begin;

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_code text not null,
  status text not null default 'active',
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null,
  description text null,
  category text null,
  trade text null,
  unit_of_measure text not null default 'each',

  standard_cost numeric(14,4) not null default 0,
  average_cost numeric(14,4) not null default 0,
  last_purchase_cost numeric(14,4) not null default 0,
  markup_percent numeric(9,4) not null default 0,
  suggested_sell_price numeric(14,4) not null default 0,

  preferred_vendor_id uuid null references public.vendors(id) on delete set null,
  manufacturer text null,
  manufacturer_part_number text null,
  vendor_part_number text null,
  lead_time_days integer null,

  track_inventory boolean not null default false,
  current_stock numeric(14,3) not null default 0,
  reorder_point numeric(14,3) not null default 0,
  reorder_quantity numeric(14,3) not null default 0,
  warehouse_location text null,
  bin_location text null,

  weight numeric(14,4) null,
  width numeric(14,4) null,
  height numeric(14,4) null,
  length numeric(14,4) null,

  last_purchase_date date null,
  notes text null,

  constraint materials_material_code_not_blank_check check (btrim(material_code) <> ''),
  constraint materials_name_not_blank_check check (btrim(name) <> ''),
  constraint materials_status_check check (
    status in ('active', 'inactive', 'discontinued', 'archived')
  ),
  constraint materials_unit_of_measure_not_blank_check check (btrim(unit_of_measure) <> ''),
  constraint materials_standard_cost_non_negative_check check (standard_cost >= 0),
  constraint materials_average_cost_non_negative_check check (average_cost >= 0),
  constraint materials_last_purchase_cost_non_negative_check check (last_purchase_cost >= 0),
  constraint materials_markup_percent_non_negative_check check (markup_percent >= 0),
  constraint materials_suggested_sell_price_non_negative_check check (suggested_sell_price >= 0),
  constraint materials_lead_time_days_non_negative_check check (lead_time_days is null or lead_time_days >= 0),
  constraint materials_current_stock_non_negative_check check (current_stock >= 0),
  constraint materials_reorder_point_non_negative_check check (reorder_point >= 0),
  constraint materials_reorder_quantity_non_negative_check check (reorder_quantity >= 0),
  constraint materials_weight_non_negative_check check (weight is null or weight >= 0),
  constraint materials_width_non_negative_check check (width is null or width >= 0),
  constraint materials_height_non_negative_check check (height is null or height >= 0),
  constraint materials_length_non_negative_check check (length is null or length >= 0)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'materials_company_id_material_code_unique'
  ) then
    alter table public.materials
      add constraint materials_company_id_material_code_unique unique (company_id, material_code);
  end if;
end $$;

create index if not exists idx_materials_company_status
  on public.materials(company_id, status);

create index if not exists idx_materials_company_name
  on public.materials(company_id, name);

create index if not exists idx_materials_company_category
  on public.materials(company_id, category);

create index if not exists idx_materials_company_trade
  on public.materials(company_id, trade);

create index if not exists idx_materials_company_preferred_vendor
  on public.materials(company_id, preferred_vendor_id);

create index if not exists idx_materials_company_updated_at
  on public.materials(company_id, updated_at desc);

create index if not exists idx_materials_company_stock
  on public.materials(company_id, current_stock);

alter table public.materials enable row level security;

drop policy if exists materials_select on public.materials;
drop policy if exists materials_insert on public.materials;
drop policy if exists materials_update on public.materials;
drop policy if exists materials_delete on public.materials;

create policy materials_select
on public.materials
for select
to authenticated
using (
  public.is_company_member(materials.company_id)
);

create policy materials_insert
on public.materials
for insert
to authenticated
with check (
  public.has_company_role(
    materials.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (materials.created_by is null or materials.created_by = auth.uid())
  and (materials.updated_by is null or materials.updated_by = auth.uid())
  and (
    materials.preferred_vendor_id is null
    or exists (
      select 1
      from public.vendors v
      where v.id = materials.preferred_vendor_id
        and v.company_id = materials.company_id
    )
  )
);

create policy materials_update
on public.materials
for update
to authenticated
using (
  public.has_company_role(
    materials.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
)
with check (
  public.has_company_role(
    materials.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (materials.updated_by is null or materials.updated_by = auth.uid())
  and (
    materials.preferred_vendor_id is null
    or exists (
      select 1
      from public.vendors v
      where v.id = materials.preferred_vendor_id
        and v.company_id = materials.company_id
    )
  )
);

create policy materials_delete
on public.materials
for delete
to authenticated
using (
  public.has_company_role(materials.company_id, array['owner', 'administrator'])
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
      'estimates',
      'invoices',
      'project_phases',
      'tasks',
      'vendors'
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
      and c.relname = 'materials'
      and t.tgname = 'trg_materials_set_updated_at'
  ) then
    execute format(
      'create trigger trg_materials_set_updated_at before update on public.materials for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;

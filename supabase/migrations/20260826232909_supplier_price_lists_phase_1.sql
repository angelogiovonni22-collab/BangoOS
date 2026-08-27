begin;

create table if not exists public.supplier_price_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null,
  list_name text not null,
  branch_name text null,
  effective_on date not null,
  expires_on date null,
  verified_on date not null default current_date,
  source_filename text not null,
  status text not null default 'active',
  row_count integer not null default 0,
  matched_count integer not null default 0,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint supplier_price_lists_name_not_blank check (btrim(list_name) <> ''),
  constraint supplier_price_lists_source_not_blank check (btrim(source_filename) <> ''),
  constraint supplier_price_lists_status_check check (status in ('draft', 'active', 'expired', 'archived')),
  constraint supplier_price_lists_counts_check check (row_count >= 0 and matched_count >= 0 and matched_count <= row_count),
  constraint supplier_price_lists_dates_check check (expires_on is null or expires_on >= effective_on),
  constraint supplier_price_lists_vendor_company_fkey foreign key (vendor_id, company_id)
    references public.vendors(id, company_id) on delete restrict
);

alter table public.supplier_price_lists
  add constraint supplier_price_lists_id_company_unique unique (id, company_id);

create table if not exists public.supplier_price_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  price_list_id uuid not null,
  vendor_id uuid not null,
  material_id uuid null,
  supplier_sku text not null,
  product_description text not null,
  manufacturer text null,
  model_number text null,
  package_quantity numeric(14,4) not null default 1,
  unit_of_measure text not null default 'each',
  unit_price numeric(14,4) not null,
  contractor_price numeric(14,4) null,
  availability text null,
  match_status text not null default 'unmatched',
  match_confidence numeric(5,4) null,
  source_row jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint supplier_price_entries_sku_not_blank check (btrim(supplier_sku) <> ''),
  constraint supplier_price_entries_description_not_blank check (btrim(product_description) <> ''),
  constraint supplier_price_entries_package_positive check (package_quantity > 0),
  constraint supplier_price_entries_unit_not_blank check (btrim(unit_of_measure) <> ''),
  constraint supplier_price_entries_price_non_negative check (unit_price >= 0 and (contractor_price is null or contractor_price >= 0)),
  constraint supplier_price_entries_match_status_check check (match_status in ('unmatched', 'suggested', 'confirmed', 'rejected')),
  constraint supplier_price_entries_confidence_check check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  constraint supplier_price_entries_list_company_fkey foreign key (price_list_id, company_id)
    references public.supplier_price_lists(id, company_id) on delete cascade,
  constraint supplier_price_entries_vendor_company_fkey foreign key (vendor_id, company_id)
    references public.vendors(id, company_id) on delete restrict,
  constraint supplier_price_entries_material_company_fkey foreign key (material_id, company_id)
    references public.materials(id, company_id) on delete set null (material_id)
);

alter table public.supplier_price_entries
  add constraint supplier_price_entries_id_company_unique unique (id, company_id);

alter table public.estimate_line_items
  add column if not exists material_id uuid null,
  add column if not exists supplier_price_entry_id uuid null,
  add column if not exists supplier_vendor_id uuid null,
  add column if not exists cost_source text null,
  add column if not exists cost_verified_on date null,
  add column if not exists supplier_unit_cost_snapshot numeric(14,4) null,
  add column if not exists cost_override boolean not null default false;

alter table public.estimate_line_items
  add constraint estimate_line_items_material_company_fkey foreign key (material_id, company_id)
    references public.materials(id, company_id) on delete set null (material_id),
  add constraint estimate_line_items_supplier_entry_company_fkey foreign key (supplier_price_entry_id, company_id)
    references public.supplier_price_entries(id, company_id) on delete set null (supplier_price_entry_id),
  add constraint estimate_line_items_supplier_vendor_company_fkey foreign key (supplier_vendor_id, company_id)
    references public.vendors(id, company_id) on delete set null (supplier_vendor_id),
  add constraint estimate_line_items_supplier_cost_non_negative check (
    supplier_unit_cost_snapshot is null or supplier_unit_cost_snapshot >= 0
  );

create unique index if not exists idx_supplier_price_entries_list_sku
  on public.supplier_price_entries(price_list_id, lower(supplier_sku));
create index if not exists idx_supplier_price_lists_company_vendor_effective
  on public.supplier_price_lists(company_id, vendor_id, effective_on desc);
create index if not exists idx_supplier_price_lists_vendor_company
  on public.supplier_price_lists(vendor_id, company_id);
create index if not exists idx_supplier_price_lists_created_by
  on public.supplier_price_lists(created_by) where created_by is not null;
create index if not exists idx_supplier_price_entries_company_material_created
  on public.supplier_price_entries(company_id, material_id, created_at desc)
  where material_id is not null;
create index if not exists idx_supplier_price_entries_company_sku
  on public.supplier_price_entries(company_id, lower(supplier_sku));
create index if not exists idx_supplier_price_entries_list_company
  on public.supplier_price_entries(price_list_id, company_id);
create index if not exists idx_supplier_price_entries_vendor_company
  on public.supplier_price_entries(vendor_id, company_id);
create index if not exists idx_supplier_price_entries_material_company
  on public.supplier_price_entries(material_id, company_id) where material_id is not null;
create index if not exists idx_supplier_price_entries_created_by
  on public.supplier_price_entries(created_by) where created_by is not null;
create index if not exists idx_estimate_line_items_material_company
  on public.estimate_line_items(material_id, company_id) where material_id is not null;
create index if not exists idx_estimate_line_items_supplier_entry_company
  on public.estimate_line_items(supplier_price_entry_id, company_id) where supplier_price_entry_id is not null;
create index if not exists idx_estimate_line_items_supplier_vendor_company
  on public.estimate_line_items(supplier_vendor_id, company_id) where supplier_vendor_id is not null;

alter table public.supplier_price_lists enable row level security;
alter table public.supplier_price_entries enable row level security;

create policy supplier_price_lists_select on public.supplier_price_lists
  for select to authenticated using (public.is_company_member(company_id));
create policy supplier_price_lists_insert on public.supplier_price_lists
  for insert to authenticated with check (
    public.has_company_role(company_id, array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator'])
    and (created_by is null or created_by = (select auth.uid()))
  );
create policy supplier_price_lists_update on public.supplier_price_lists
  for update to authenticated
  using (public.has_company_role(company_id, array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']))
  with check (public.has_company_role(company_id, array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']));
create policy supplier_price_lists_delete on public.supplier_price_lists
  for delete to authenticated using (public.has_company_role(company_id, array['owner', 'administrator']));

create policy supplier_price_entries_select on public.supplier_price_entries
  for select to authenticated using (public.is_company_member(company_id));
create policy supplier_price_entries_insert on public.supplier_price_entries
  for insert to authenticated with check (
    public.has_company_role(company_id, array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator'])
    and (created_by is null or created_by = (select auth.uid()))
    and exists (
      select 1 from public.supplier_price_lists list
      where list.id = price_list_id and list.company_id = supplier_price_entries.company_id
        and list.vendor_id = supplier_price_entries.vendor_id
    )
  );
create policy supplier_price_entries_update on public.supplier_price_entries
  for update to authenticated
  using (public.has_company_role(company_id, array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']))
  with check (
    public.has_company_role(company_id, array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator'])
    and exists (
      select 1 from public.supplier_price_lists list
      where list.id = price_list_id and list.company_id = supplier_price_entries.company_id
        and list.vendor_id = supplier_price_entries.vendor_id
    )
  );
create policy supplier_price_entries_delete on public.supplier_price_entries
  for delete to authenticated using (public.has_company_role(company_id, array['owner', 'administrator']));

create or replace function public.import_supplier_price_list(
  p_company_id uuid,
  p_vendor_id uuid,
  p_list_name text,
  p_branch_name text,
  p_effective_on date,
  p_expires_on date,
  p_verified_on date,
  p_source_filename text,
  p_rows jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_list_id uuid;
  v_row_count integer;
begin
  if not public.has_company_role(
    p_company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  ) then
    raise exception 'Not authorized to import supplier prices.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'At least one valid price row is required.' using errcode = '22023';
  end if;

  v_row_count := jsonb_array_length(p_rows);

  insert into public.supplier_price_lists (
    company_id, vendor_id, list_name, branch_name, effective_on, expires_on,
    verified_on, source_filename, status, row_count, matched_count, created_by
  ) values (
    p_company_id, p_vendor_id, btrim(p_list_name), nullif(btrim(p_branch_name), ''),
    p_effective_on, p_expires_on, p_verified_on, btrim(p_source_filename),
    'active', v_row_count, 0, (select auth.uid())
  ) returning id into v_list_id;

  insert into public.supplier_price_entries (
    company_id, price_list_id, vendor_id, supplier_sku, product_description,
    manufacturer, model_number, package_quantity, unit_of_measure, unit_price,
    contractor_price, availability, source_row, created_by
  )
  select
    p_company_id, v_list_id, p_vendor_id, btrim(row.supplier_sku),
    btrim(row.product_description), nullif(btrim(row.manufacturer), ''),
    nullif(btrim(row.model_number), ''), row.package_quantity,
    coalesce(nullif(btrim(row.unit_of_measure), ''), 'each'), row.unit_price,
    row.contractor_price, nullif(btrim(row.availability), ''),
    coalesce(row.source_row, '{}'::jsonb), (select auth.uid())
  from jsonb_to_recordset(p_rows) as row(
    supplier_sku text,
    product_description text,
    manufacturer text,
    model_number text,
    package_quantity numeric,
    unit_of_measure text,
    unit_price numeric,
    contractor_price numeric,
    availability text,
    source_row jsonb
  );

  return v_list_id;
end;
$$;

revoke all on function public.import_supplier_price_list(uuid, uuid, text, text, date, date, date, text, jsonb) from public;
grant execute on function public.import_supplier_price_list(uuid, uuid, text, text, date, date, date, text, jsonb) to authenticated;

comment on table public.supplier_price_lists is 'Immutable supplier price-list import headers. New uploads create dated lists instead of overwriting price history.';
comment on table public.supplier_price_entries is 'Supplier price rows linked to the canonical material catalog with retained source-row evidence.';

commit;

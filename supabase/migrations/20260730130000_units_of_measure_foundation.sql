begin;

create table if not exists public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  plural_name text null,
  symbol text null,
  description text null,
  category text not null,
  measurement_system text not null default 'universal',
  unit_type text not null default 'standard',
  base_unit_id uuid null,
  conversion_factor numeric(18,8) null,
  decimal_precision integer not null default 2,
  allow_fractional_quantity boolean not null default true,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint units_of_measure_code_not_blank_check check (btrim(code) <> ''),
  constraint units_of_measure_name_not_blank_check check (btrim(name) <> ''),
  constraint units_of_measure_category_check check (
    category in (
      'count',
      'time',
      'length',
      'area',
      'volume',
      'weight',
      'mass',
      'liquid',
      'material',
      'packaging',
      'equipment',
      'labor',
      'temperature',
      'currency',
      'percentage',
      'other'
    )
  ),
  constraint units_of_measure_measurement_system_check check (
    measurement_system in ('universal', 'imperial', 'metric', 'custom')
  ),
  constraint units_of_measure_unit_type_check check (
    unit_type in ('standard', 'derived', 'packaging', 'custom')
  ),
  constraint units_of_measure_decimal_precision_check check (
    decimal_precision between 0 and 8
  ),
  constraint units_of_measure_sort_order_check check (sort_order >= 0),
  constraint units_of_measure_conversion_factor_check check (
    conversion_factor is null or conversion_factor > 0
  ),
  constraint units_of_measure_system_company_check check (
    (is_system = true and company_id is null)
    or (is_system = false and company_id is not null)
  ),
  constraint units_of_measure_base_not_self_check check (
    base_unit_id is null or base_unit_id <> id
  )
);

alter table public.units_of_measure
  drop constraint if exists units_of_measure_base_unit_id_fkey,
  add constraint units_of_measure_base_unit_id_fkey
    foreign key (base_unit_id)
    references public.units_of_measure(id)
    on delete set null;

create index if not exists idx_units_of_measure_company_id
  on public.units_of_measure(company_id);

create index if not exists idx_units_of_measure_code
  on public.units_of_measure(code);

create index if not exists idx_units_of_measure_code_lower
  on public.units_of_measure(lower(code));

create index if not exists idx_units_of_measure_name
  on public.units_of_measure(name);

create index if not exists idx_units_of_measure_category
  on public.units_of_measure(category);

create index if not exists idx_units_of_measure_measurement_system
  on public.units_of_measure(measurement_system);

create index if not exists idx_units_of_measure_is_system
  on public.units_of_measure(is_system);

create index if not exists idx_units_of_measure_is_active
  on public.units_of_measure(is_active);

create index if not exists idx_units_of_measure_sort_order
  on public.units_of_measure(sort_order);

create index if not exists idx_units_of_measure_base_unit_id
  on public.units_of_measure(base_unit_id);

create index if not exists idx_units_of_measure_updated_at
  on public.units_of_measure(updated_at desc);

create unique index if not exists ux_units_of_measure_system_code_ci
  on public.units_of_measure(lower(code))
  where is_system = true;

create unique index if not exists ux_units_of_measure_company_code_ci
  on public.units_of_measure(company_id, lower(code))
  where is_system = false;

create or replace function public.trg_units_of_measure_validate_fn()
returns trigger
language plpgsql
as $$
declare
  v_base public.units_of_measure%rowtype;
begin
  if new.base_unit_id is not null and new.id is not null and new.base_unit_id = new.id then
    raise exception 'A unit cannot reference itself as base unit.';
  end if;

  if new.base_unit_id is not null then
    select *
      into v_base
    from public.units_of_measure u
    where u.id = new.base_unit_id;

    if not found then
      raise exception 'Base unit does not exist.';
    end if;

    if v_base.id = new.id then
      raise exception 'A unit cannot reference itself as base unit.';
    end if;

    if v_base.base_unit_id = new.id then
      raise exception 'Circular base-unit references are not allowed.';
    end if;

    if v_base.category <> new.category then
      raise exception 'Base unit category must match the unit category.';
    end if;

    if (
      new.measurement_system <> v_base.measurement_system
      and new.measurement_system <> 'universal'
      and v_base.measurement_system <> 'universal'
    ) then
      raise exception 'Base unit measurement system is incompatible.';
    end if;

    if new.is_system then
      if not v_base.is_system or v_base.company_id is not null then
        raise exception 'System units may only reference system base units.';
      end if;
    else
      if v_base.is_system then
        if v_base.company_id is not null then
          raise exception 'System base units must have company_id set to null.';
        end if;
      elsif v_base.company_id is distinct from new.company_id then
        raise exception 'Company units may only reference system units or units in the same company.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_units_of_measure_validate on public.units_of_measure;

create trigger trg_units_of_measure_validate
before insert or update on public.units_of_measure
for each row
execute function public.trg_units_of_measure_validate_fn();

alter table public.units_of_measure enable row level security;

drop policy if exists units_of_measure_select on public.units_of_measure;
drop policy if exists units_of_measure_insert on public.units_of_measure;
drop policy if exists units_of_measure_update on public.units_of_measure;
drop policy if exists units_of_measure_delete on public.units_of_measure;

create policy units_of_measure_select
on public.units_of_measure
for select
to authenticated
using (
  (units_of_measure.is_system = true and units_of_measure.company_id is null)
  or public.is_company_member(units_of_measure.company_id)
);

create policy units_of_measure_insert
on public.units_of_measure
for insert
to authenticated
with check (
  units_of_measure.is_system = false
  and units_of_measure.company_id is not null
  and public.has_company_role(
    units_of_measure.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (units_of_measure.created_by is null or units_of_measure.created_by = auth.uid())
  and (units_of_measure.updated_by is null or units_of_measure.updated_by = auth.uid())
);

create policy units_of_measure_update
on public.units_of_measure
for update
to authenticated
using (
  units_of_measure.is_system = false
  and public.has_company_role(
    units_of_measure.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
)
with check (
  units_of_measure.is_system = false
  and public.has_company_role(
    units_of_measure.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (units_of_measure.updated_by is null or units_of_measure.updated_by = auth.uid())
);

create policy units_of_measure_delete
on public.units_of_measure
for delete
to authenticated
using (
  units_of_measure.is_system = false
  and public.has_company_role(units_of_measure.company_id, array['owner', 'administrator'])
);

-- Default system unit seeding approach:
-- - Seed system-managed units via migrations or platform admin tooling only.
-- - This function is idempotent and can be re-run safely.
create or replace function public.seed_default_system_units_of_measure()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inch_id uuid;
  v_sqin_id uuid;
  v_cf_id uuid;
  v_floz_id uuid;
  v_oz_id uuid;
  v_ea_id uuid;
begin
  insert into public.units_of_measure (
    company_id,
    code,
    name,
    plural_name,
    symbol,
    category,
    measurement_system,
    unit_type,
    decimal_precision,
    allow_fractional_quantity,
    is_system,
    is_active,
    sort_order,
    notes
  )
  values
    (null, 'EA', 'Each', 'Each', 'EA', 'count', 'universal', 'standard', 0, false, true, true, 10, 'System default unit'),
    (null, 'HR', 'Hour', 'Hours', 'HR', 'time', 'universal', 'standard', 2, true, true, true, 20, 'System default unit'),
    (null, 'IN', 'Inch', 'Inches', 'IN', 'length', 'imperial', 'standard', 3, true, true, true, 30, 'Imperial base length unit'),
    (null, 'SQIN', 'Square Inch', 'Square Inches', 'SQIN', 'area', 'imperial', 'standard', 3, true, true, true, 40, 'Imperial base area unit'),
    (null, 'CF', 'Cubic Foot', 'Cubic Feet', 'CF', 'volume', 'imperial', 'standard', 3, true, true, true, 50, 'Imperial base volume unit'),
    (null, 'FLOZ', 'Fluid Ounce', 'Fluid Ounces', 'FLOZ', 'liquid', 'imperial', 'standard', 3, true, true, true, 60, 'Imperial base liquid unit'),
    (null, 'OZ', 'Ounce', 'Ounces', 'OZ', 'weight', 'imperial', 'standard', 3, true, true, true, 70, 'Imperial base weight unit')
  on conflict do nothing;

  select id into v_inch_id from public.units_of_measure where is_system = true and code = 'IN' limit 1;
  select id into v_sqin_id from public.units_of_measure where is_system = true and code = 'SQIN' limit 1;
  select id into v_cf_id from public.units_of_measure where is_system = true and code = 'CF' limit 1;
  select id into v_floz_id from public.units_of_measure where is_system = true and code = 'FLOZ' limit 1;
  select id into v_oz_id from public.units_of_measure where is_system = true and code = 'OZ' limit 1;
  select id into v_ea_id from public.units_of_measure where is_system = true and code = 'EA' limit 1;

  insert into public.units_of_measure (
    company_id,
    code,
    name,
    plural_name,
    symbol,
    category,
    measurement_system,
    unit_type,
    base_unit_id,
    conversion_factor,
    decimal_precision,
    allow_fractional_quantity,
    is_system,
    is_active,
    sort_order,
    notes
  )
  values
    (null, 'FT', 'Foot', 'Feet', 'FT', 'length', 'imperial', 'derived', v_inch_id, 12, 3, true, true, true, 31, '1 FT = 12 IN'),
    (null, 'DOZ', 'Dozen', 'Dozens', 'DOZ', 'count', 'universal', 'derived', v_ea_id, 12, 0, false, true, true, 11, '1 DOZ = 12 EA'),
    (null, 'SF', 'Square Foot', 'Square Feet', 'SF', 'area', 'imperial', 'derived', v_sqin_id, 144, 3, true, true, true, 41, '1 SF = 144 SQIN'),
    (null, 'CY', 'Cubic Yard', 'Cubic Yards', 'CY', 'volume', 'imperial', 'derived', v_cf_id, 27, 3, true, true, true, 51, '1 CY = 27 CF'),
    (null, 'GAL', 'Gallon', 'Gallons', 'GAL', 'liquid', 'imperial', 'derived', v_floz_id, 128, 3, true, true, true, 61, '1 GAL = 128 FLOZ'),
    (null, 'LB', 'Pound', 'Pounds', 'LB', 'weight', 'imperial', 'derived', v_oz_id, 16, 3, true, true, true, 71, '1 LB = 16 OZ'),
    (null, 'M', 'Meter', 'Meters', 'M', 'length', 'metric', 'standard', null, null, 3, true, true, true, 80, 'Metric base length unit'),
    (null, 'BOX', 'Box', 'Boxes', 'BOX', 'packaging', 'universal', 'packaging', null, null, 0, false, true, true, 90, 'Packaging unit')
  on conflict do nothing;
end;
$$;

select public.seed_default_system_units_of_measure();

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
      'vendors',
      'materials',
      'cost_codes',
      'labor_rates',
      'equipment'
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
      and c.relname = 'units_of_measure'
      and t.tgname = 'trg_units_of_measure_set_updated_at'
  ) then
    execute format(
      'create trigger trg_units_of_measure_set_updated_at before update on public.units_of_measure for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;

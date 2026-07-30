begin;

-- Equipment master record for company-owned and third-party assets.
-- Assignment relationships remain nullable UUIDs unless a stable parent table is available.

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  equipment_number text not null,
  name text not null,
  description text null,
  status text not null default 'active',
  equipment_type text null,
  category text null,
  subcategory text null,

  manufacturer text null,
  model text null,
  model_year integer null,
  serial_number text null,
  vin text null,
  license_plate text null,
  asset_tag text null,
  barcode text null,
  qr_code text null,

  ownership_type text not null default 'owned',
  vendor_id uuid null,
  owner_name text null,
  lease_start_date date null,
  lease_end_date date null,
  rental_start_date date null,
  rental_end_date date null,
  rental_agreement_number text null,

  current_location_type text null,
  current_location_name text null,
  assigned_job_id uuid null,
  assigned_employee_id uuid null,
  assigned_crew_id uuid null,
  assigned_at timestamptz null,
  expected_return_date date null,

  purchase_date date null,
  purchase_price numeric(14,4) not null default 0,
  current_value numeric(14,4) not null default 0,
  salvage_value numeric(14,4) not null default 0,
  financed_amount numeric(14,4) not null default 0,
  monthly_payment numeric(14,4) not null default 0,
  lease_monthly_cost numeric(14,4) not null default 0,
  rental_daily_cost numeric(14,4) not null default 0,
  rental_weekly_cost numeric(14,4) not null default 0,
  rental_monthly_cost numeric(14,4) not null default 0,
  depreciation_method text null,
  useful_life_years numeric(10,2) null,
  depreciation_start_date date null,
  warranty_expiration_date date null,

  hourly_internal_cost numeric(14,4) not null default 0,
  hourly_billable_rate numeric(14,4) not null default 0,
  daily_internal_cost numeric(14,4) not null default 0,
  daily_billable_rate numeric(14,4) not null default 0,
  fuel_type text null,
  estimated_fuel_cost_per_hour numeric(14,4) not null default 0,
  maintenance_cost_per_hour numeric(14,4) not null default 0,
  insurance_cost_per_hour numeric(14,4) not null default 0,
  other_operating_cost_per_hour numeric(14,4) not null default 0,
  total_operating_cost_per_hour numeric(14,4) not null default 0,
  effective_internal_hourly_cost numeric(14,4) not null default 0,

  meter_type text null,
  current_meter_reading numeric(14,3) not null default 0,
  meter_unit text null,
  last_meter_updated_at timestamptz null,
  lifetime_hours numeric(14,3) not null default 0,
  lifetime_miles numeric(14,3) not null default 0,

  maintenance_status text not null default 'current',
  last_service_date date null,
  next_service_date date null,
  last_service_meter numeric(14,3) null,
  next_service_meter numeric(14,3) null,
  service_interval_days integer null,
  service_interval_meter numeric(14,3) null,
  maintenance_notes text null,

  registration_expiration_date date null,
  inspection_expiration_date date null,
  insurance_expiration_date date null,
  certification_expiration_date date null,
  requires_operator_certification boolean not null default false,
  required_certification_type text null,
  safety_notes text null,

  default_cost_code_id uuid null,
  default_unit_of_measure text null,
  default_quantity numeric(14,4) not null default 1,
  taxable boolean not null default false,

  criticality_level text not null default 'standard',
  utilization_target_percent numeric(9,4) null,
  replacement_priority text not null default 'normal',
  replacement_score numeric(9,4) null,
  condition_score numeric(9,4) null,
  reliability_score numeric(9,4) null,
  ai_notes text null,

  notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint equipment_equipment_number_not_blank_check check (btrim(equipment_number) <> ''),
  constraint equipment_name_not_blank_check check (btrim(name) <> ''),
  constraint equipment_status_check check (
    status in ('active', 'inactive', 'maintenance', 'out_of_service', 'retired', 'sold', 'lost', 'stolen')
  ),
  constraint equipment_type_check check (
    equipment_type is null
    or equipment_type in (
      'heavy_equipment',
      'vehicle',
      'trailer',
      'power_tool',
      'hand_tool',
      'safety_equipment',
      'office_equipment',
      'technology',
      'rented_equipment',
      'other'
    )
  ),
  constraint equipment_ownership_type_check check (
    ownership_type in ('owned', 'financed', 'leased', 'rented', 'subcontractor_provided', 'employee_owned', 'other')
  ),
  constraint equipment_current_location_type_check check (
    current_location_type is null
    or current_location_type in (
      'warehouse',
      'jobsite',
      'vehicle',
      'employee',
      'rental_provider',
      'repair_shop',
      'office',
      'unknown',
      'other'
    )
  ),
  constraint equipment_meter_type_check check (
    meter_type is null or meter_type in ('hours', 'mileage', 'cycles', 'none', 'other')
  ),
  constraint equipment_depreciation_method_check check (
    depreciation_method is null or depreciation_method in ('straight_line', 'declining_balance', 'units_of_production', 'none', 'other')
  ),
  constraint equipment_maintenance_status_check check (
    maintenance_status in ('current', 'due_soon', 'overdue', 'in_service', 'unavailable', 'not_required')
  ),
  constraint equipment_criticality_level_check check (
    criticality_level in ('low', 'standard', 'high', 'mission_critical')
  ),
  constraint equipment_replacement_priority_check check (
    replacement_priority in ('low', 'normal', 'high', 'urgent')
  ),
  constraint equipment_purchase_price_non_negative_check check (purchase_price >= 0),
  constraint equipment_current_value_non_negative_check check (current_value >= 0),
  constraint equipment_salvage_value_non_negative_check check (salvage_value >= 0),
  constraint equipment_financed_amount_non_negative_check check (financed_amount >= 0),
  constraint equipment_monthly_payment_non_negative_check check (monthly_payment >= 0),
  constraint equipment_lease_monthly_cost_non_negative_check check (lease_monthly_cost >= 0),
  constraint equipment_rental_daily_cost_non_negative_check check (rental_daily_cost >= 0),
  constraint equipment_rental_weekly_cost_non_negative_check check (rental_weekly_cost >= 0),
  constraint equipment_rental_monthly_cost_non_negative_check check (rental_monthly_cost >= 0),
  constraint equipment_hourly_internal_cost_non_negative_check check (hourly_internal_cost >= 0),
  constraint equipment_hourly_billable_rate_non_negative_check check (hourly_billable_rate >= 0),
  constraint equipment_daily_internal_cost_non_negative_check check (daily_internal_cost >= 0),
  constraint equipment_daily_billable_rate_non_negative_check check (daily_billable_rate >= 0),
  constraint equipment_estimated_fuel_cost_per_hour_non_negative_check check (estimated_fuel_cost_per_hour >= 0),
  constraint equipment_maintenance_cost_per_hour_non_negative_check check (maintenance_cost_per_hour >= 0),
  constraint equipment_insurance_cost_per_hour_non_negative_check check (insurance_cost_per_hour >= 0),
  constraint equipment_other_operating_cost_per_hour_non_negative_check check (other_operating_cost_per_hour >= 0),
  constraint equipment_total_operating_cost_per_hour_non_negative_check check (total_operating_cost_per_hour >= 0),
  constraint equipment_effective_internal_hourly_cost_non_negative_check check (effective_internal_hourly_cost >= 0),
  constraint equipment_current_meter_reading_non_negative_check check (current_meter_reading >= 0),
  constraint equipment_lifetime_hours_non_negative_check check (lifetime_hours >= 0),
  constraint equipment_lifetime_miles_non_negative_check check (lifetime_miles >= 0),
  constraint equipment_last_service_meter_non_negative_check check (last_service_meter is null or last_service_meter >= 0),
  constraint equipment_next_service_meter_non_negative_check check (next_service_meter is null or next_service_meter >= 0),
  constraint equipment_service_interval_days_non_negative_check check (service_interval_days is null or service_interval_days >= 0),
  constraint equipment_service_interval_meter_non_negative_check check (service_interval_meter is null or service_interval_meter >= 0),
  constraint equipment_default_quantity_non_negative_check check (default_quantity >= 0),
  constraint equipment_utilization_target_percent_check check (utilization_target_percent is null or (utilization_target_percent >= 0 and utilization_target_percent <= 100)),
  constraint equipment_replacement_score_check check (replacement_score is null or (replacement_score >= 0 and replacement_score <= 100)),
  constraint equipment_condition_score_check check (condition_score is null or (condition_score >= 0 and condition_score <= 100)),
  constraint equipment_reliability_score_check check (reliability_score is null or (reliability_score >= 0 and reliability_score <= 100)),
  constraint equipment_model_year_check check (
    model_year is null or (model_year between 1900 and extract(year from current_date)::integer + 1)
  ),
  constraint equipment_useful_life_years_check check (useful_life_years is null or useful_life_years >= 0),
  constraint equipment_lease_date_order_check check (
    lease_start_date is null or lease_end_date is null or lease_end_date >= lease_start_date
  ),
  constraint equipment_rental_date_order_check check (
    rental_start_date is null or rental_end_date is null or rental_end_date >= rental_start_date
  ),
  constraint equipment_service_date_order_check check (
    last_service_date is null or next_service_date is null or next_service_date >= last_service_date
  ),
  constraint equipment_depreciation_date_order_check check (
    purchase_date is null or depreciation_start_date is null or depreciation_start_date >= purchase_date
  ),
  constraint equipment_warranty_date_after_purchase_check check (
    purchase_date is null or warranty_expiration_date is null or warranty_expiration_date >= purchase_date
  ),
  constraint equipment_registration_date_reasonable_check check (
    purchase_date is null or registration_expiration_date is null or registration_expiration_date >= purchase_date
  ),
  constraint equipment_inspection_date_reasonable_check check (
    purchase_date is null or inspection_expiration_date is null or inspection_expiration_date >= purchase_date
  ),
  constraint equipment_insurance_date_reasonable_check check (
    purchase_date is null or insurance_expiration_date is null or insurance_expiration_date >= purchase_date
  ),
  constraint equipment_certification_date_reasonable_check check (
    purchase_date is null or certification_expiration_date is null or certification_expiration_date >= purchase_date
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipment_company_id_equipment_number_unique'
  ) then
    alter table public.equipment
      add constraint equipment_company_id_equipment_number_unique unique (company_id, equipment_number);
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
    where conname = 'equipment_id_company_unique'
  ) then
    alter table public.equipment
      add constraint equipment_id_company_unique unique (id, company_id);
  end if;
end $$;

alter table public.equipment
  drop constraint if exists equipment_vendor_company_fkey,
  add constraint equipment_vendor_company_fkey
    foreign key (vendor_id, company_id)
    references public.vendors(id, company_id)
    on delete set null;

alter table public.equipment
  drop constraint if exists equipment_default_cost_code_company_fkey,
  add constraint equipment_default_cost_code_company_fkey
    foreign key (default_cost_code_id, company_id)
    references public.cost_codes(id, company_id)
    on delete set null;

create index if not exists idx_equipment_company_status
  on public.equipment(company_id, status);

create index if not exists idx_equipment_company_number
  on public.equipment(company_id, equipment_number);

create index if not exists idx_equipment_company_name
  on public.equipment(company_id, name);

create index if not exists idx_equipment_company_type
  on public.equipment(company_id, equipment_type);

create index if not exists idx_equipment_company_category
  on public.equipment(company_id, category);

create index if not exists idx_equipment_company_ownership_type
  on public.equipment(company_id, ownership_type);

create index if not exists idx_equipment_company_vendor
  on public.equipment(company_id, vendor_id);

create index if not exists idx_equipment_company_maintenance_status
  on public.equipment(company_id, maintenance_status);

create index if not exists idx_equipment_company_location_type
  on public.equipment(company_id, current_location_type);

create index if not exists idx_equipment_company_default_cost_code
  on public.equipment(company_id, default_cost_code_id);

create index if not exists idx_equipment_company_criticality_level
  on public.equipment(company_id, criticality_level);

create index if not exists idx_equipment_company_replacement_priority
  on public.equipment(company_id, replacement_priority);

create index if not exists idx_equipment_company_next_service_date
  on public.equipment(company_id, next_service_date);

create index if not exists idx_equipment_company_updated_at
  on public.equipment(company_id, updated_at desc);

create index if not exists idx_equipment_company_current_value
  on public.equipment(company_id, current_value desc);

create index if not exists idx_equipment_company_purchase_price
  on public.equipment(company_id, purchase_price desc);

alter table public.equipment enable row level security;

drop policy if exists equipment_select on public.equipment;
drop policy if exists equipment_insert on public.equipment;
drop policy if exists equipment_update on public.equipment;
drop policy if exists equipment_delete on public.equipment;

create policy equipment_select
on public.equipment
for select
to authenticated
using (
  public.is_company_member(equipment.company_id)
);

create policy equipment_insert
on public.equipment
for insert
to authenticated
with check (
  public.has_company_role(
    equipment.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (equipment.created_by is null or equipment.created_by = auth.uid())
  and (equipment.updated_by is null or equipment.updated_by = auth.uid())
);

create policy equipment_update
on public.equipment
for update
to authenticated
using (
  public.has_company_role(
    equipment.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
)
with check (
  public.has_company_role(
    equipment.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (equipment.updated_by is null or equipment.updated_by = auth.uid())
);

create policy equipment_delete
on public.equipment
for delete
to authenticated
using (
  public.has_company_role(equipment.company_id, array['owner', 'administrator'])
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
      'vendors',
      'materials',
      'cost_codes',
      'labor_rates'
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
      and c.relname = 'equipment'
      and t.tgname = 'trg_equipment_set_updated_at'
  ) then
    execute format(
      'create trigger trg_equipment_set_updated_at before update on public.equipment for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;

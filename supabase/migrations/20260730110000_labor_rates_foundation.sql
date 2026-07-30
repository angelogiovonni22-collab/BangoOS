begin;

create table if not exists public.labor_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text null,
  status text not null default 'active',

  trade text null,
  position_title text null,
  skill_level text null,
  employment_type text null,
  union_status text null,
  worker_classification text null,
  default_cost_code_id uuid null,
  currency_code text not null default 'USD',

  base_hourly_rate numeric(14,4) not null default 0,
  overtime_multiplier numeric(9,4) not null default 1.5,
  double_time_multiplier numeric(9,4) not null default 2,
  weekend_multiplier numeric(9,4) not null default 1,
  holiday_multiplier numeric(9,4) not null default 2,
  shift_differential numeric(14,4) not null default 0,
  bonus_hourly_allocation numeric(14,4) not null default 0,

  payroll_tax_hourly numeric(14,4) not null default 0,
  workers_comp_hourly numeric(14,4) not null default 0,
  health_insurance_hourly numeric(14,4) not null default 0,
  retirement_hourly numeric(14,4) not null default 0,
  paid_time_off_hourly numeric(14,4) not null default 0,
  training_hourly numeric(14,4) not null default 0,
  vehicle_allowance_hourly numeric(14,4) not null default 0,
  phone_allowance_hourly numeric(14,4) not null default 0,
  tool_allowance_hourly numeric(14,4) not null default 0,
  uniform_hourly numeric(14,4) not null default 0,
  other_burden_hourly numeric(14,4) not null default 0,

  total_burden_hourly numeric(14,4) not null default 0,
  true_hourly_cost numeric(14,4) not null default 0,
  overhead_markup_percent numeric(9,4) not null default 0,
  profit_markup_percent numeric(9,4) not null default 0,
  billable_hourly_rate numeric(14,4) not null default 0,

  production_unit text null,
  production_rate numeric(14,4) null,
  production_period text null,
  crew_size numeric(10,2) null,
  notes text null,

  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint labor_rates_code_not_blank_check check (btrim(code) <> ''),
  constraint labor_rates_name_not_blank_check check (btrim(name) <> ''),
  constraint labor_rates_status_check check (
    status in ('active', 'inactive', 'archived')
  ),
  constraint labor_rates_skill_level_check check (
    skill_level is null
    or skill_level in ('apprentice', 'helper', 'journeyman', 'foreman', 'superintendent', 'specialist', 'other')
  ),
  constraint labor_rates_employment_type_check check (
    employment_type is null
    or employment_type in ('employee', 'temporary', 'subcontracted_labor', 'other')
  ),
  constraint labor_rates_union_status_check check (
    union_status is null
    or union_status in ('union', 'non_union', 'prevailing_wage', 'not_applicable')
  ),
  constraint labor_rates_worker_classification_check check (
    worker_classification is null
    or worker_classification in ('w2', '1099', 'temporary', 'other')
  ),
  constraint labor_rates_currency_code_check check (currency_code ~ '^[A-Z]{3}$'),
  constraint labor_rates_base_hourly_rate_non_negative_check check (base_hourly_rate >= 0),
  constraint labor_rates_overtime_multiplier_valid_check check (overtime_multiplier >= 1 and overtime_multiplier <= 10),
  constraint labor_rates_double_time_multiplier_valid_check check (double_time_multiplier >= 1 and double_time_multiplier <= 10),
  constraint labor_rates_weekend_multiplier_valid_check check (weekend_multiplier >= 0 and weekend_multiplier <= 10),
  constraint labor_rates_holiday_multiplier_valid_check check (holiday_multiplier >= 0 and holiday_multiplier <= 10),
  constraint labor_rates_shift_differential_non_negative_check check (shift_differential >= 0),
  constraint labor_rates_bonus_hourly_allocation_non_negative_check check (bonus_hourly_allocation >= 0),
  constraint labor_rates_payroll_tax_hourly_non_negative_check check (payroll_tax_hourly >= 0),
  constraint labor_rates_workers_comp_hourly_non_negative_check check (workers_comp_hourly >= 0),
  constraint labor_rates_health_insurance_hourly_non_negative_check check (health_insurance_hourly >= 0),
  constraint labor_rates_retirement_hourly_non_negative_check check (retirement_hourly >= 0),
  constraint labor_rates_paid_time_off_hourly_non_negative_check check (paid_time_off_hourly >= 0),
  constraint labor_rates_training_hourly_non_negative_check check (training_hourly >= 0),
  constraint labor_rates_vehicle_allowance_hourly_non_negative_check check (vehicle_allowance_hourly >= 0),
  constraint labor_rates_phone_allowance_hourly_non_negative_check check (phone_allowance_hourly >= 0),
  constraint labor_rates_tool_allowance_hourly_non_negative_check check (tool_allowance_hourly >= 0),
  constraint labor_rates_uniform_hourly_non_negative_check check (uniform_hourly >= 0),
  constraint labor_rates_other_burden_hourly_non_negative_check check (other_burden_hourly >= 0),
  constraint labor_rates_total_burden_hourly_non_negative_check check (total_burden_hourly >= 0),
  constraint labor_rates_true_hourly_cost_non_negative_check check (true_hourly_cost >= 0),
  constraint labor_rates_overhead_markup_percent_non_negative_check check (overhead_markup_percent >= 0 and overhead_markup_percent <= 500),
  constraint labor_rates_profit_markup_percent_non_negative_check check (profit_markup_percent >= 0 and profit_markup_percent <= 500),
  constraint labor_rates_billable_hourly_rate_non_negative_check check (billable_hourly_rate >= 0),
  constraint labor_rates_production_rate_non_negative_check check (production_rate is null or production_rate >= 0),
  constraint labor_rates_crew_size_positive_check check (crew_size is null or crew_size > 0),
  constraint labor_rates_production_period_check check (
    production_period is null
    or production_period in ('hour', 'day', 'shift')
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'labor_rates_company_id_code_unique'
  ) then
    alter table public.labor_rates
      add constraint labor_rates_company_id_code_unique unique (company_id, code);
  end if;
end $$;

alter table public.labor_rates
  drop constraint if exists labor_rates_default_cost_code_company_fkey,
  add constraint labor_rates_default_cost_code_company_fkey
    foreign key (default_cost_code_id, company_id)
    references public.cost_codes(id, company_id)
    on delete set null;

create index if not exists idx_labor_rates_company_status
  on public.labor_rates(company_id, status);

create index if not exists idx_labor_rates_company_code
  on public.labor_rates(company_id, code);

create index if not exists idx_labor_rates_company_name
  on public.labor_rates(company_id, name);

create index if not exists idx_labor_rates_company_trade
  on public.labor_rates(company_id, trade);

create index if not exists idx_labor_rates_company_skill_level
  on public.labor_rates(company_id, skill_level);

create index if not exists idx_labor_rates_company_union_status
  on public.labor_rates(company_id, union_status);

create index if not exists idx_labor_rates_company_worker_classification
  on public.labor_rates(company_id, worker_classification);

create index if not exists idx_labor_rates_company_default_cost_code
  on public.labor_rates(company_id, default_cost_code_id);

create index if not exists idx_labor_rates_company_base_hourly_rate
  on public.labor_rates(company_id, base_hourly_rate desc);

create index if not exists idx_labor_rates_company_true_hourly_cost
  on public.labor_rates(company_id, true_hourly_cost desc);

create index if not exists idx_labor_rates_company_billable_hourly_rate
  on public.labor_rates(company_id, billable_hourly_rate desc);

create index if not exists idx_labor_rates_company_updated_at
  on public.labor_rates(company_id, updated_at desc);

alter table public.labor_rates enable row level security;

drop policy if exists labor_rates_select on public.labor_rates;
drop policy if exists labor_rates_insert on public.labor_rates;
drop policy if exists labor_rates_update on public.labor_rates;
drop policy if exists labor_rates_delete on public.labor_rates;

create policy labor_rates_select
on public.labor_rates
for select
to authenticated
using (
  public.is_company_member(labor_rates.company_id)
);

create policy labor_rates_insert
on public.labor_rates
for insert
to authenticated
with check (
  public.has_company_role(
    labor_rates.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (labor_rates.created_by is null or labor_rates.created_by = auth.uid())
  and (labor_rates.updated_by is null or labor_rates.updated_by = auth.uid())
);

create policy labor_rates_update
on public.labor_rates
for update
to authenticated
using (
  public.has_company_role(
    labor_rates.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
)
with check (
  public.has_company_role(
    labor_rates.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (labor_rates.updated_by is null or labor_rates.updated_by = auth.uid())
);

create policy labor_rates_delete
on public.labor_rates
for delete
to authenticated
using (
  public.has_company_role(labor_rates.company_id, array['owner', 'administrator'])
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
      and c.relname = 'labor_rates'
      and t.tgname = 'trg_labor_rates_set_updated_at'
  ) then
    execute format(
      'create trigger trg_labor_rates_set_updated_at before update on public.labor_rates for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;

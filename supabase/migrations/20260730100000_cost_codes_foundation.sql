begin;

create table if not exists public.cost_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text null,
  status text not null default 'active',

  division text null,
  category text null,
  trade text null,
  parent_cost_code_id uuid null,

  default_labor_rate_id uuid null,
  default_material_category_id uuid null,
  default_equipment_category_id uuid null,

  budget numeric(14,2) not null default 0,
  committed_cost numeric(14,2) not null default 0,
  actual_cost numeric(14,2) not null default 0,

  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cost_codes_code_not_blank_check check (btrim(code) <> ''),
  constraint cost_codes_name_not_blank_check check (btrim(name) <> ''),
  constraint cost_codes_status_check check (
    status in ('active', 'inactive', 'archived')
  ),
  constraint cost_codes_budget_non_negative_check check (budget >= 0),
  constraint cost_codes_committed_cost_non_negative_check check (committed_cost >= 0),
  constraint cost_codes_actual_cost_non_negative_check check (actual_cost >= 0),
  constraint cost_codes_parent_not_self_check check (parent_cost_code_id is null or parent_cost_code_id <> id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cost_codes_company_id_code_unique'
  ) then
    alter table public.cost_codes
      add constraint cost_codes_company_id_code_unique unique (company_id, code);
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

alter table public.cost_codes
  drop constraint if exists cost_codes_parent_company_fkey,
  add constraint cost_codes_parent_company_fkey
    foreign key (parent_cost_code_id, company_id)
    references public.cost_codes(id, company_id)
    on delete set null;

create index if not exists idx_cost_codes_company_status
  on public.cost_codes(company_id, status);

create index if not exists idx_cost_codes_company_code
  on public.cost_codes(company_id, code);

create index if not exists idx_cost_codes_company_name
  on public.cost_codes(company_id, name);

create index if not exists idx_cost_codes_company_division
  on public.cost_codes(company_id, division);

create index if not exists idx_cost_codes_company_category
  on public.cost_codes(company_id, category);

create index if not exists idx_cost_codes_company_trade
  on public.cost_codes(company_id, trade);

create index if not exists idx_cost_codes_company_parent
  on public.cost_codes(company_id, parent_cost_code_id);

create index if not exists idx_cost_codes_company_updated_at
  on public.cost_codes(company_id, updated_at desc);

alter table public.cost_codes enable row level security;

drop policy if exists cost_codes_select on public.cost_codes;
drop policy if exists cost_codes_insert on public.cost_codes;
drop policy if exists cost_codes_update on public.cost_codes;
drop policy if exists cost_codes_delete on public.cost_codes;

create policy cost_codes_select
on public.cost_codes
for select
to authenticated
using (
  public.is_company_member(cost_codes.company_id)
);

create policy cost_codes_insert
on public.cost_codes
for insert
to authenticated
with check (
  public.has_company_role(
    cost_codes.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (cost_codes.created_by is null or cost_codes.created_by = auth.uid())
  and (cost_codes.updated_by is null or cost_codes.updated_by = auth.uid())
);

create policy cost_codes_update
on public.cost_codes
for update
to authenticated
using (
  public.has_company_role(
    cost_codes.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
)
with check (
  public.has_company_role(
    cost_codes.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant', 'estimator']
  )
  and (cost_codes.updated_by is null or cost_codes.updated_by = auth.uid())
);

create policy cost_codes_delete
on public.cost_codes
for delete
to authenticated
using (
  public.has_company_role(cost_codes.company_id, array['owner', 'administrator'])
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
      'materials'
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
      and c.relname = 'cost_codes'
      and t.tgname = 'trg_cost_codes_set_updated_at'
  ) then
    execute format(
      'create trigger trg_cost_codes_set_updated_at before update on public.cost_codes for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;

begin;

-- Ensure composite keys exist for company-scoped foreign keys.
do $$
begin
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
    where conname = 'profiles_id_company_unique'
  ) then
    alter table public.profiles
      add constraint profiles_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendors_id_company_unique'
  ) then
    alter table public.vendors
      add constraint vendors_id_company_unique unique (id, company_id);
  end if;
end $$;

create table if not exists public.trade_partner_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  vendor_id uuid not null,
  trade_name text not null,
  scope_of_work text null,
  primary_contact_name text null,
  primary_contact_phone text null,
  primary_contact_email text null,
  contract_status text not null default 'draft',
  contract_amount numeric(14,2) null,
  payment_terms text null,
  retainage_percent numeric(5,2) null,
  start_date date null,
  target_completion_date date null,
  crew_size integer null,
  assignment_status text not null default 'active',
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trade_partner_assignments_trade_name_not_blank_check
    check (btrim(trade_name) <> ''),
  constraint trade_partner_assignments_contract_status_check
    check (contract_status in ('draft', 'pending_signature', 'signed', 'cancelled', 'closed')),
  constraint trade_partner_assignments_contract_amount_non_negative_check
    check (contract_amount is null or contract_amount >= 0),
  constraint trade_partner_assignments_retainage_percent_range_check
    check (retainage_percent is null or (retainage_percent >= 0 and retainage_percent <= 100)),
  constraint trade_partner_assignments_crew_size_non_negative_check
    check (crew_size is null or crew_size >= 0),
  constraint trade_partner_assignments_assignment_status_check
    check (assignment_status in ('active', 'inactive', 'archived')),
  constraint trade_partner_assignments_target_after_start_check
    check (target_completion_date is null or start_date is null or target_completion_date >= start_date)
);

alter table public.trade_partner_assignments
  drop constraint if exists trade_partner_assignments_project_company_fkey,
  add constraint trade_partner_assignments_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.trade_partner_assignments
  drop constraint if exists trade_partner_assignments_vendor_company_fkey,
  add constraint trade_partner_assignments_vendor_company_fkey
    foreign key (vendor_id, company_id)
    references public.vendors(id, company_id)
    on delete restrict;

alter table public.trade_partner_assignments
  drop constraint if exists trade_partner_assignments_created_by_company_fkey,
  add constraint trade_partner_assignments_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.trade_partner_assignments
  drop constraint if exists trade_partner_assignments_updated_by_company_fkey,
  add constraint trade_partner_assignments_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

-- Prevent duplicate active assignment for same vendor within a project, while allowing historical inactive/archived rows.
create unique index if not exists idx_trade_partner_assignments_active_unique
  on public.trade_partner_assignments(company_id, project_id, vendor_id)
  where assignment_status = 'active';

create index if not exists idx_trade_partner_assignments_company_id
  on public.trade_partner_assignments(company_id);

create index if not exists idx_trade_partner_assignments_company_project_id
  on public.trade_partner_assignments(company_id, project_id);

create index if not exists idx_trade_partner_assignments_company_vendor_id
  on public.trade_partner_assignments(company_id, vendor_id);

create index if not exists idx_trade_partner_assignments_company_assignment_status
  on public.trade_partner_assignments(company_id, assignment_status);

alter table public.trade_partner_assignments enable row level security;

drop policy if exists trade_partner_assignments_select on public.trade_partner_assignments;
drop policy if exists trade_partner_assignments_insert on public.trade_partner_assignments;
drop policy if exists trade_partner_assignments_update on public.trade_partner_assignments;
drop policy if exists trade_partner_assignments_delete on public.trade_partner_assignments;

create policy trade_partner_assignments_select
on public.trade_partner_assignments
for select
to authenticated
using (
  public.is_company_member(trade_partner_assignments.company_id)
);

create policy trade_partner_assignments_insert
on public.trade_partner_assignments
for insert
to authenticated
with check (
  public.has_company_role(
    trade_partner_assignments.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager']
  )
  and (trade_partner_assignments.created_by is null or trade_partner_assignments.created_by = auth.uid())
  and (trade_partner_assignments.updated_by is null or trade_partner_assignments.updated_by = auth.uid())
);

create policy trade_partner_assignments_update
on public.trade_partner_assignments
for update
to authenticated
using (
  public.has_company_role(
    trade_partner_assignments.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager']
  )
)
with check (
  public.has_company_role(
    trade_partner_assignments.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'office_manager']
  )
  and (trade_partner_assignments.updated_by is null or trade_partner_assignments.updated_by = auth.uid())
);

create policy trade_partner_assignments_delete
on public.trade_partner_assignments
for delete
to authenticated
using (
  public.has_company_role(trade_partner_assignments.company_id, array['owner', 'administrator'])
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
      'tasks'
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
      and c.relname = 'trade_partner_assignments'
      and t.tgname = 'trg_trade_partner_assignments_set_updated_at'
  ) then
    execute format(
      'create trigger trg_trade_partner_assignments_set_updated_at before update on public.trade_partner_assignments for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;

begin;

alter table public.company_memberships
  add column if not exists department text,
  add column if not exists vendor_id uuid,
  add column if not exists customer_id uuid,
  add column if not exists permission_overrides jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'company_memberships_vendor_fkey') then
    alter table public.company_memberships
      add constraint company_memberships_vendor_fkey
      foreign key (vendor_id) references public.vendors(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'company_memberships_customer_fkey') then
    alter table public.company_memberships
      add constraint company_memberships_customer_fkey
      foreign key (customer_id) references public.customers(id) on delete set null;
  end if;
end $$;

create index if not exists idx_company_memberships_vendor_id on public.company_memberships(vendor_id) where vendor_id is not null;
create index if not exists idx_company_memberships_customer_id on public.company_memberships(customer_id) where customer_id is not null;
create index if not exists idx_company_memberships_department on public.company_memberships(company_id, department) where department is not null;

create or replace function public.bos_role_has_permission(
  p_company_id uuid,
  p_permission text,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_overrides jsonb;
  v_override jsonb;
  v_allowed boolean := false;
begin
  select lower(cm.role), coalesce(cm.permission_overrides, '{}'::jsonb)
    into v_role, v_overrides
  from public.company_memberships cm
  where cm.company_id = p_company_id
    and cm.user_id = p_user_id
    and cm.status = 'active'
  limit 1;

  if v_role is null and exists(select 1 from public.companies c where c.id = p_company_id and c.owner_id = p_user_id) then
    v_role := 'owner';
    v_overrides := '{}'::jsonb;
  end if;

  if v_role is null then return false; end if;

  v_override := v_overrides -> p_permission;
  if jsonb_typeof(v_override) = 'boolean' then
    return (v_override #>> '{}')::boolean;
  end if;

  if v_role in ('owner','administrator') then return true; end if;

  v_allowed := case p_permission
    when 'dashboard.view' then v_role in ('operations_manager','project_manager','office_manager','accountant')
    when 'operations.view' then v_role in ('operations_manager','project_manager','superintendent','foreman')
    when 'projects.view' then v_role in ('operations_manager','project_manager','estimator','superintendent','office_manager','accountant','foreman','employee')
    when 'projects.manage' then v_role in ('operations_manager','project_manager')
    when 'project_financials.view' then v_role in ('operations_manager','project_manager','estimator','office_manager','accountant')
    when 'schedule.view' then v_role in ('operations_manager','project_manager','superintendent','office_manager','foreman','employee','subcontractor','customer')
    when 'schedule.manage' then v_role in ('operations_manager','project_manager','superintendent','office_manager')
    when 'daily_reports.view' then v_role in ('operations_manager','project_manager','superintendent','office_manager','foreman','employee')
    when 'daily_reports.manage' then v_role in ('operations_manager','project_manager','superintendent','foreman','employee')
    when 'blueprints.view' then v_role in ('operations_manager','project_manager','estimator','superintendent','foreman','employee','subcontractor')
    when 'blueprints.manage' then v_role in ('operations_manager','project_manager','superintendent')
    when 'photos.view' then v_role in ('operations_manager','project_manager','superintendent','foreman','employee','subcontractor','customer')
    when 'photos.manage' then v_role in ('operations_manager','project_manager','superintendent','foreman','employee','subcontractor')
    when 'communications.view' then v_role in ('operations_manager','project_manager','superintendent','office_manager','foreman','employee','subcontractor','customer')
    when 'communications.manage' then v_role in ('operations_manager','project_manager','superintendent','office_manager','foreman','employee','subcontractor')
    when 'scope.view' then v_role in ('operations_manager','project_manager','estimator','superintendent','foreman','employee','subcontractor','customer')
    when 'customers.view' then v_role in ('operations_manager','project_manager','estimator','office_manager','accountant')
    when 'customers.manage' then v_role in ('operations_manager','project_manager','estimator','office_manager')
    when 'estimates.view' then v_role in ('operations_manager','project_manager','estimator','office_manager','accountant')
    when 'estimates.manage' then v_role in ('operations_manager','project_manager','estimator','office_manager')
    when 'invoices.view' then v_role in ('operations_manager','project_manager','office_manager','accountant')
    when 'invoices.manage' then v_role in ('office_manager','accountant')
    when 'change_orders.view' then v_role in ('operations_manager','project_manager','office_manager','accountant')
    when 'change_orders.manage' then v_role in ('operations_manager','project_manager')
    when 'labor_rates.view' then v_role in ('operations_manager','project_manager','estimator','office_manager','accountant')
    when 'labor_rates.manage' then v_role in ('accountant')
    when 'workforce.view' then v_role in ('operations_manager','project_manager','superintendent','office_manager','foreman','employee')
    when 'workforce.manage' then v_role in ('operations_manager','project_manager','superintendent','office_manager')
    when 'equipment.view' then v_role in ('operations_manager','project_manager','superintendent','foreman','employee')
    when 'equipment.manage' then v_role in ('operations_manager','project_manager','superintendent')
    when 'materials.view' then v_role in ('operations_manager','project_manager','estimator','superintendent','foreman')
    when 'materials.manage' then v_role in ('operations_manager','project_manager')
    when 'vendors.view' then v_role in ('operations_manager','project_manager','estimator','superintendent','office_manager','accountant')
    when 'vendors.manage' then v_role in ('operations_manager','office_manager')
    when 'settings.view' then v_role in ('operations_manager','office_manager')
    when 'settings.manage' then v_role in ('operations_manager')
    when 'access_control.manage' then false
    when 'subcontractor_portal.view' then v_role = 'subcontractor'
    when 'customer_portal.view' then v_role = 'customer'
    else false
  end;

  return v_allowed;
end;
$$;

grant execute on function public.bos_role_has_permission(uuid,text,uuid) to authenticated;

-- Membership directory: external users may only read their own membership.
drop policy if exists company_memberships_role_visibility_guard on public.company_memberships;
create policy company_memberships_role_visibility_guard
on public.company_memberships
as restrictive
for select
to authenticated
using (
  company_memberships.user_id = auth.uid()
  or public.has_company_role(company_memberships.company_id, array['owner','administrator','operations_manager','office_manager'])
);

-- Sensitive tables retain their existing company policies, with an additional restrictive role gate.
do $$
declare
  item record;
  policy_name text;
begin
  for item in
    select * from (values
      ('projects','projects.view'),
      ('customers','customers.view'),
      ('estimates','estimates.view'),
      ('invoices','invoices.view'),
      ('change_orders','change_orders.view'),
      ('labor_rates','labor_rates.view'),
      ('cost_codes','project_financials.view'),
      ('trade_partner_assignments','vendors.view'),
      ('payroll_runs','project_financials.view'),
      ('payroll_entries','project_financials.view'),
      ('employee_compensation','project_financials.view')
    ) as x(table_name, permission_name)
  loop
    if to_regclass('public.' || item.table_name) is not null then
      policy_name := 'bos_role_guard_' || item.table_name;
      execute format('drop policy if exists %I on public.%I', policy_name, item.table_name);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (public.bos_role_has_permission(company_id, %L)) with check (public.bos_role_has_permission(company_id, %L))',
        policy_name, item.table_name, item.permission_name, item.permission_name
      );
    end if;
  end loop;
end $$;

-- A subcontractor never queries the financial trade_partner_assignments row directly.
-- This RPC exposes only the linked vendor's operational assignment fields.
create or replace function public.get_my_trade_partner_jobs()
returns table(
  assignment_id uuid,
  project_id uuid,
  project_name text,
  project_status text,
  address_line_1 text,
  city text,
  state text,
  postal_code text,
  trade_name text,
  scope_of_work text,
  start_date date,
  target_completion_date date,
  assignment_status text,
  contract_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    tpa.id,
    p.id,
    p.name,
    p.status,
    p.address_line_1,
    p.city,
    p.state,
    p.postal_code,
    tpa.trade_name,
    tpa.scope_of_work,
    tpa.start_date,
    tpa.target_completion_date,
    tpa.assignment_status,
    tpa.contract_status
  from public.company_memberships cm
  join public.trade_partner_assignments tpa
    on tpa.company_id = cm.company_id
   and tpa.vendor_id = cm.vendor_id
   and tpa.assignment_status = 'active'
  join public.projects p
    on p.id = tpa.project_id
   and p.company_id = tpa.company_id
  where cm.user_id = auth.uid()
    and cm.status = 'active'
    and lower(cm.role) = 'subcontractor'
    and cm.vendor_id is not null
  order by coalesce(tpa.start_date, current_date), p.name;
$$;

grant execute on function public.get_my_trade_partner_jobs() to authenticated;

create or replace function public.get_my_customer_projects()
returns table(
  project_id uuid,
  project_name text,
  project_status text,
  address_line_1 text,
  city text,
  state text,
  postal_code text,
  estimated_start_date date,
  estimated_end_date date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.name,
    p.status,
    p.address_line_1,
    p.city,
    p.state,
    p.postal_code,
    p.estimated_start_date,
    p.estimated_end_date
  from public.company_memberships cm
  join public.projects p
    on p.company_id = cm.company_id
   and p.customer_id = cm.customer_id
  where cm.user_id = auth.uid()
    and cm.status = 'active'
    and lower(cm.role) = 'customer'
    and cm.customer_id is not null
  order by p.created_at desc;
$$;

grant execute on function public.get_my_customer_projects() to authenticated;

commit;

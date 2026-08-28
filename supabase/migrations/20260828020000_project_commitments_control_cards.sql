begin;

create table if not exists public.project_labor_commitments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  employee_id uuid,
  crew_id uuid,
  compensation_method text not null check (compensation_method in ('payroll_rate','hourly','day_rate','piece_rate','lump_sum','prevailing_wage')),
  rate numeric(14,4) not null default 0 check (rate >= 0),
  projected_hours numeric(12,2) not null default 0 check (projected_hours >= 0),
  projected_days numeric(12,2) not null default 0 check (projected_days >= 0),
  projected_units numeric(12,2) not null default 0 check (projected_units >= 0),
  lump_sum_amount numeric(14,2) not null default 0 check (lump_sum_amount >= 0),
  actual_hours numeric(12,2) not null default 0 check (actual_hours >= 0),
  actual_days numeric(12,2) not null default 0 check (actual_days >= 0),
  actual_units numeric(12,2) not null default 0 check (actual_units >= 0),
  actual_cost_override numeric(14,2) check (actual_cost_override is null or actual_cost_override >= 0),
  rate_details jsonb not null default '{}'::jsonb,
  notes text,
  projected_cost numeric(14,2) generated always as (
    round(case compensation_method
      when 'payroll_rate' then projected_hours * rate
      when 'hourly' then projected_hours * rate
      when 'prevailing_wage' then projected_hours * rate
      when 'day_rate' then projected_days * rate
      when 'piece_rate' then projected_units * rate
      when 'lump_sum' then lump_sum_amount
      else 0 end, 2)
  ) stored,
  actual_cost numeric(14,2) generated always as (
    round(coalesce(actual_cost_override, case compensation_method
      when 'payroll_rate' then actual_hours * rate
      when 'hourly' then actual_hours * rate
      when 'prevailing_wage' then actual_hours * rate
      when 'day_rate' then actual_days * rate
      when 'piece_rate' then actual_units * rate
      else 0 end), 2)
  ) stored,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade,
  foreign key (employee_id, company_id) references public.employees(id, company_id) on delete cascade,
  foreign key (crew_id, company_id) references public.crews(id, company_id) on delete cascade,
  check ((employee_id is not null)::integer + (crew_id is not null)::integer = 1)
);

create index if not exists project_labor_commitments_project_idx
  on public.project_labor_commitments(company_id, project_id);
create unique index if not exists project_labor_commitments_employee_unique
  on public.project_labor_commitments(company_id, project_id, employee_id)
  where employee_id is not null;
create unique index if not exists project_labor_commitments_crew_unique
  on public.project_labor_commitments(company_id, project_id, crew_id)
  where crew_id is not null;

alter table public.project_labor_commitments enable row level security;
drop policy if exists project_labor_commitments_read on public.project_labor_commitments;
drop policy if exists project_labor_commitments_write on public.project_labor_commitments;
drop policy if exists project_labor_commitments_insert on public.project_labor_commitments;
drop policy if exists project_labor_commitments_update on public.project_labor_commitments;
drop policy if exists project_labor_commitments_delete on public.project_labor_commitments;

create policy project_labor_commitments_read on public.project_labor_commitments
  for select to authenticated
  using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));
create policy project_labor_commitments_insert on public.project_labor_commitments
  for insert to authenticated
  with check (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));
create policy project_labor_commitments_update on public.project_labor_commitments
  for update to authenticated
  using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']))
  with check (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));
create policy project_labor_commitments_delete on public.project_labor_commitments
  for delete to authenticated
  using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));

create or replace function public.save_project_labor_commitment(
  p_company_id uuid,
  p_project_id uuid,
  p_employee_id uuid default null,
  p_crew_id uuid default null,
  p_compensation_method text default 'hourly',
  p_rate numeric default 0,
  p_projected_hours numeric default 0,
  p_projected_days numeric default 0,
  p_projected_units numeric default 0,
  p_lump_sum_amount numeric default 0,
  p_rate_details jsonb default '{}'::jsonb,
  p_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid;
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager','project_manager']) then
    raise exception 'Not authorized';
  end if;
  if p_compensation_method not in ('payroll_rate','hourly','day_rate','piece_rate','lump_sum','prevailing_wage') then
    raise exception 'Unsupported compensation method';
  end if;
  if ((p_employee_id is not null)::integer + (p_crew_id is not null)::integer) <> 1 then
    raise exception 'Exactly one employee or crew is required';
  end if;
  if coalesce(p_rate,0) < 0 or coalesce(p_projected_hours,0) < 0 or coalesce(p_projected_days,0) < 0 or coalesce(p_projected_units,0) < 0 or coalesce(p_lump_sum_amount,0) < 0 then
    raise exception 'Compensation values cannot be negative';
  end if;
  if not exists(select 1 from public.projects where id=p_project_id and company_id=p_company_id) then
    raise exception 'Project not found';
  end if;
  if p_employee_id is not null and not exists(select 1 from public.employees where id=p_employee_id and company_id=p_company_id) then
    raise exception 'Employee not found';
  end if;
  if p_crew_id is not null and not exists(select 1 from public.crews where id=p_crew_id and company_id=p_company_id) then
    raise exception 'Crew not found';
  end if;

  if p_employee_id is not null then
    select id into v_id from public.project_labor_commitments
      where company_id=p_company_id and project_id=p_project_id and employee_id=p_employee_id limit 1;
  else
    select id into v_id from public.project_labor_commitments
      where company_id=p_company_id and project_id=p_project_id and crew_id=p_crew_id limit 1;
  end if;

  if v_id is null then
    insert into public.project_labor_commitments(
      company_id,project_id,employee_id,crew_id,compensation_method,rate,
      projected_hours,projected_days,projected_units,lump_sum_amount,rate_details,notes,created_by,updated_by
    ) values (
      p_company_id,p_project_id,p_employee_id,p_crew_id,p_compensation_method,coalesce(p_rate,0),
      coalesce(p_projected_hours,0),coalesce(p_projected_days,0),coalesce(p_projected_units,0),coalesce(p_lump_sum_amount,0),coalesce(p_rate_details,'{}'::jsonb),nullif(btrim(p_notes),''),auth.uid(),auth.uid()
    ) returning id into v_id;
  else
    update public.project_labor_commitments set
      compensation_method=p_compensation_method,
      rate=coalesce(p_rate,0),
      projected_hours=coalesce(p_projected_hours,0),
      projected_days=coalesce(p_projected_days,0),
      projected_units=coalesce(p_projected_units,0),
      lump_sum_amount=coalesce(p_lump_sum_amount,0),
      rate_details=coalesce(p_rate_details,'{}'::jsonb),
      notes=nullif(btrim(p_notes),''),
      updated_by=auth.uid(),updated_at=now()
    where id=v_id;
  end if;
  return v_id;
end $$;
grant execute on function public.save_project_labor_commitment(uuid,uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,numeric,jsonb,text) to authenticated;

create or replace function public.protect_executed_subcontract_terms()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.contract_status in ('signed','closed') and (
    new.vendor_id is distinct from old.vendor_id or
    new.trade_name is distinct from old.trade_name or
    new.scope_of_work is distinct from old.scope_of_work or
    new.contract_amount is distinct from old.contract_amount or
    new.payment_terms is distinct from old.payment_terms or
    new.retainage_percent is distinct from old.retainage_percent or
    new.start_date is distinct from old.start_date or
    new.target_completion_date is distinct from old.target_completion_date
  ) then
    raise exception 'Executed subcontract terms are locked. Use a subcontract change order or new work authorization for commercial changes.';
  end if;
  return new;
end $$;
drop trigger if exists trade_partner_assignment_terms_lock on public.trade_partner_assignments;
create trigger trade_partner_assignment_terms_lock
before update of vendor_id, trade_name, scope_of_work, contract_amount, payment_terms, retainage_percent, start_date, target_completion_date
on public.trade_partner_assignments
for each row execute function public.protect_executed_subcontract_terms();

create or replace function public.activate_cleared_subcontractor_assignment()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.contract_status = 'signed' and new.mobilization_status = 'cleared' then
    new.assignment_status := 'active';
  elsif new.assignment_status <> 'archived' then
    new.assignment_status := 'inactive';
  end if;
  return new;
end $$;
drop trigger if exists trade_partner_assignment_activation on public.trade_partner_assignments;
create trigger trade_partner_assignment_activation
before insert or update of contract_status, mobilization_status
on public.trade_partner_assignments
for each row execute function public.activate_cleared_subcontractor_assignment();

commit;

begin;

alter table public.payroll_employee_settings
  drop constraint if exists payroll_employee_settings_pay_basis_check;
alter table public.payroll_employee_settings
  add constraint payroll_employee_settings_pay_basis_check
  check (pay_basis in ('hourly','salary','day_rate','piece_rate'));
alter table public.payroll_employee_settings
  add column if not exists salary_amount numeric(14,2) check (salary_amount >= 0),
  add column if not exists day_rate numeric(12,2) check (day_rate >= 0),
  add column if not exists piece_rate numeric(12,4) check (piece_rate >= 0),
  add column if not exists compensation_notes text;

create table public.project_labor_commitments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  employee_id uuid,
  crew_id uuid,
  compensation_method text not null check (compensation_method in ('hourly','salary','day_rate','piece_rate')),
  rate numeric(14,4) not null check (rate >= 0),
  projected_hours numeric(12,2) not null default 0 check (projected_hours >= 0),
  projected_days numeric(12,2) not null default 0 check (projected_days >= 0),
  projected_units numeric(12,2) not null default 0 check (projected_units >= 0),
  actual_hours numeric(12,2) not null default 0 check (actual_hours >= 0),
  actual_days numeric(12,2) not null default 0 check (actual_days >= 0),
  actual_units numeric(12,2) not null default 0 check (actual_units >= 0),
  projected_cost numeric(14,2) generated always as (round(case compensation_method when 'hourly' then projected_hours*rate when 'salary' then projected_hours*(rate/2080) when 'day_rate' then projected_days*rate else projected_units*rate end,2)) stored,
  actual_cost numeric(14,2) generated always as (round(case compensation_method when 'hourly' then actual_hours*rate when 'salary' then actual_hours*(rate/2080) when 'day_rate' then actual_days*rate else actual_units*rate end,2)) stored,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade,
  foreign key (employee_id, company_id) references public.employees(id, company_id) on delete cascade,
  foreign key (crew_id, company_id) references public.crews(id, company_id) on delete cascade,
  check ((employee_id is not null)::integer + (crew_id is not null)::integer = 1)
);
create index project_labor_commitments_project_idx on public.project_labor_commitments(company_id, project_id);
alter table public.project_labor_commitments enable row level security;
create policy project_labor_commitments_read on public.project_labor_commitments for select to authenticated
  using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager','foreman']));
create policy project_labor_commitments_write on public.project_labor_commitments for all to authenticated
  using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']))
  with check (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));

create or replace function public.save_payroll_employee_compensation(p_company_id uuid,p_employee_id uuid,p_pay_basis text,p_rate numeric,p_overtime_multiplier numeric default 1.5,p_fringe_hourly numeric default 0,p_provider text default null,p_provider_employee_id text default null)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
  if p_pay_basis not in ('hourly','salary','day_rate','piece_rate') or p_rate < 0 or p_overtime_multiplier < 1 or p_fringe_hourly < 0 then raise exception 'Invalid compensation setting'; end if;
  insert into public.payroll_employee_settings(company_id,employee_id,pay_basis,hourly_rate,salary_amount,day_rate,piece_rate,overtime_multiplier,fringe_hourly,provider,provider_employee_id,status,created_by,updated_by)
  values(p_company_id,p_employee_id,p_pay_basis,case when p_pay_basis='hourly' then p_rate else 0 end,case when p_pay_basis='salary' then p_rate end,case when p_pay_basis='day_rate' then p_rate end,case when p_pay_basis='piece_rate' then p_rate end,p_overtime_multiplier,p_fringe_hourly,nullif(btrim(p_provider),''),nullif(btrim(p_provider_employee_id),''),'active',auth.uid(),auth.uid())
  on conflict(company_id,employee_id) do update set pay_basis=excluded.pay_basis,hourly_rate=excluded.hourly_rate,salary_amount=excluded.salary_amount,day_rate=excluded.day_rate,piece_rate=excluded.piece_rate,overtime_multiplier=excluded.overtime_multiplier,fringe_hourly=excluded.fringe_hourly,provider=excluded.provider,provider_employee_id=excluded.provider_employee_id,status='active',updated_by=auth.uid(),updated_at=now();
end $$;
grant execute on function public.save_payroll_employee_compensation(uuid,uuid,text,numeric,numeric,numeric,text,text) to authenticated;

create or replace function public.get_payroll_workspace(p_company_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_result jsonb;
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
  select jsonb_build_object(
    'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'employee_number',e.employee_number,'name',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),e.employee_number),'position_title',e.position_title,'employment_status',e.employment_status,'pay_basis',s.pay_basis,'hourly_rate',s.hourly_rate,'salary_amount',s.salary_amount,'day_rate',s.day_rate,'piece_rate',s.piece_rate,'overtime_multiplier',s.overtime_multiplier,'fringe_hourly',s.fringe_hourly,'provider',s.provider,'provider_employee_id',s.provider_employee_id,'payroll_ready',(s.id is not null and s.status='active')) order by e.employee_number) from public.employees e left join public.profiles p on p.id=e.profile_id left join public.payroll_employee_settings s on s.company_id=e.company_id and s.employee_id=e.id where e.company_id=p_company_id and e.employment_status='active'),'[]'::jsonb),
    'periods',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'period_start',x.period_start,'period_end',x.period_end,'pay_date',x.pay_date,'status',x.status,'regular_hours',x.regular_hours,'overtime_hours',x.overtime_hours,'regular_pay',x.regular_pay,'overtime_pay',x.overtime_pay,'fringe_pay',x.fringe_pay,'gross_pay',x.gross_pay,'approved_at',x.approved_at,'exported_at',x.exported_at) order by x.period_end desc) from (select * from public.payroll_periods where company_id=p_company_id order by period_end desc limit 20) x),'[]'::jsonb),
    'approved_unprocessed_hours',coalesce((select round(sum(greatest(0,extract(epoch from (t.ended_at-t.started_at))/3600.0-t.break_minutes/60.0))::numeric,2) from public.workforce_time_entries t where t.company_id=p_company_id and t.status='approved' and t.ended_at is not null and not exists(select 1 from public.payroll_lines l where l.company_id=p_company_id and t.id=any(l.source_time_entry_ids))),0),
    'employees_needing_rates',coalesce((select count(*) from public.employees e left join public.payroll_employee_settings s on s.company_id=e.company_id and s.employee_id=e.id and s.status='active' where e.company_id=p_company_id and e.employment_status='active' and s.id is null),0)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.activate_cleared_subcontractor_assignment()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.contract_status = 'signed' and new.mobilization_status = 'cleared' then
    new.assignment_status := 'active';
  elsif new.assignment_status = 'active' and (new.contract_status <> 'signed' or new.mobilization_status <> 'cleared') then
    new.assignment_status := 'inactive';
  end if;
  return new;
end $$;
drop trigger if exists trade_partner_assignment_activation on public.trade_partner_assignments;
create trigger trade_partner_assignment_activation before insert or update of contract_status, mobilization_status
on public.trade_partner_assignments for each row execute function public.activate_cleared_subcontractor_assignment();

commit;

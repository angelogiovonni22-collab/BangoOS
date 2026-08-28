begin;

create table public.payroll_employee_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null,
  pay_basis text not null default 'hourly' check (pay_basis in ('hourly')),
  hourly_rate numeric(12,4) not null default 0 check (hourly_rate >= 0),
  overtime_multiplier numeric(6,3) not null default 1.5 check (overtime_multiplier >= 1),
  fringe_hourly numeric(12,4) not null default 0 check (fringe_hourly >= 0),
  provider text,
  provider_employee_id text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, employee_id),
  foreign key (employee_id, company_id) references public.employees(id, company_id) on delete cascade
);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  status text not null default 'draft' check (status in ('draft','review','approved','exported','void')),
  provider text,
  regular_hours numeric(12,2) not null default 0,
  overtime_hours numeric(12,2) not null default 0,
  regular_pay numeric(14,2) not null default 0,
  overtime_pay numeric(14,2) not null default 0,
  fringe_pay numeric(14,2) not null default 0,
  gross_pay numeric(14,2) not null default 0,
  approved_by uuid,
  approved_at timestamptz,
  exported_by uuid,
  exported_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (period_end - period_start <= 6),
  unique(company_id, period_start, period_end)
);

create table public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null,
  employee_name text not null,
  regular_hours numeric(12,2) not null default 0,
  overtime_hours numeric(12,2) not null default 0,
  hourly_rate numeric(12,4) not null default 0,
  overtime_rate numeric(12,4) not null default 0,
  fringe_hourly numeric(12,4) not null default 0,
  regular_pay numeric(14,2) not null default 0,
  overtime_pay numeric(14,2) not null default 0,
  fringe_pay numeric(14,2) not null default 0,
  gross_pay numeric(14,2) not null default 0,
  source_time_entry_ids uuid[] not null default '{}',
  project_allocations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(company_id, payroll_period_id, employee_id),
  foreign key (employee_id, company_id) references public.employees(id, company_id) on delete restrict
);

create index payroll_periods_company_date on public.payroll_periods(company_id, period_end desc);
create index payroll_lines_period on public.payroll_lines(company_id, payroll_period_id);

alter table public.payroll_employee_settings enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_lines enable row level security;

create policy payroll_settings_select on public.payroll_employee_settings for select to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager']));
create policy payroll_settings_write on public.payroll_employee_settings for all to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager'])) with check (public.has_company_role(company_id,array['owner','administrator','office_manager']));
create policy payroll_periods_select on public.payroll_periods for select to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager']));
create policy payroll_periods_write on public.payroll_periods for all to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager'])) with check (public.has_company_role(company_id,array['owner','administrator','office_manager']));
create policy payroll_lines_select on public.payroll_lines for select to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager']));
create policy payroll_lines_write on public.payroll_lines for all to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager'])) with check (public.has_company_role(company_id,array['owner','administrator','office_manager']));

create or replace function public.build_weekly_payroll(p_company_id uuid,p_period_start date,p_period_end date,p_pay_date date)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_period uuid; v_missing integer;
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
  if p_period_end < p_period_start or p_period_end-p_period_start > 6 then raise exception 'Payroll period must be one week or less'; end if;
  select count(*) into v_missing from (
    select distinct t.employee_id from public.workforce_time_entries t
    left join public.payroll_employee_settings s on s.company_id=t.company_id and s.employee_id=t.employee_id and s.status='active'
    where t.company_id=p_company_id and t.status='approved' and t.started_at::date between p_period_start and p_period_end and s.id is null
  ) q;
  if v_missing > 0 then raise exception '% employee(s) with approved time need payroll rates before this payroll can be built',v_missing; end if;
  insert into public.payroll_periods(company_id,period_start,period_end,pay_date,status,created_by)
  values(p_company_id,p_period_start,p_period_end,p_pay_date,'draft',auth.uid()) returning id into v_period;

  with raw as (
    select t.employee_id,
      greatest(0,extract(epoch from (t.ended_at-t.started_at))/3600.0 - t.break_minutes/60.0) as hours,
      t.id as time_id,t.project_id
    from public.workforce_time_entries t
    where t.company_id=p_company_id and t.status='approved' and t.ended_at is not null and t.started_at::date between p_period_start and p_period_end
  ), agg as (
    select employee_id,sum(hours) hours,array_agg(time_id) ids from raw group by employee_id
  )
  insert into public.payroll_lines(company_id,payroll_period_id,employee_id,employee_name,regular_hours,overtime_hours,hourly_rate,overtime_rate,fringe_hourly,regular_pay,overtime_pay,fringe_pay,gross_pay,source_time_entry_ids)
  select p_company_id,v_period,e.id,coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),e.employee_number),
    least(a.hours,40),greatest(a.hours-40,0),s.hourly_rate,s.hourly_rate*s.overtime_multiplier,s.fringe_hourly,
    round((least(a.hours,40)*s.hourly_rate)::numeric,2),round((greatest(a.hours-40,0)*s.hourly_rate*s.overtime_multiplier)::numeric,2),round((a.hours*s.fringe_hourly)::numeric,2),
    round((least(a.hours,40)*s.hourly_rate + greatest(a.hours-40,0)*s.hourly_rate*s.overtime_multiplier + a.hours*s.fringe_hourly)::numeric,2),a.ids
  from agg a join public.employees e on e.id=a.employee_id and e.company_id=p_company_id
  join public.payroll_employee_settings s on s.employee_id=e.id and s.company_id=p_company_id and s.status='active'
  left join public.profiles p on p.id=e.profile_id;

  update public.payroll_periods pp set
    regular_hours=x.regular_hours,overtime_hours=x.overtime_hours,regular_pay=x.regular_pay,overtime_pay=x.overtime_pay,fringe_pay=x.fringe_pay,gross_pay=x.gross_pay,updated_at=now()
  from (select coalesce(sum(regular_hours),0) regular_hours,coalesce(sum(overtime_hours),0) overtime_hours,coalesce(sum(regular_pay),0) regular_pay,coalesce(sum(overtime_pay),0) overtime_pay,coalesce(sum(fringe_pay),0) fringe_pay,coalesce(sum(gross_pay),0) gross_pay from public.payroll_lines where payroll_period_id=v_period) x
  where pp.id=v_period;
  return v_period;
end $$;

create or replace function public.set_payroll_status(p_company_id uuid,p_period_id uuid,p_status text)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
  if p_status not in ('review','approved','exported','void') then raise exception 'Unsupported payroll status'; end if;
  if p_status='approved' then
    update public.payroll_periods set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_period_id and company_id=p_company_id and status in ('draft','review');
  elsif p_status='exported' then
    update public.payroll_periods set status='exported',exported_by=auth.uid(),exported_at=now(),updated_at=now() where id=p_period_id and company_id=p_company_id and status='approved';
  else
    update public.payroll_periods set status=p_status,updated_at=now() where id=p_period_id and company_id=p_company_id and status not in ('exported','void');
  end if;
  if not found then raise exception 'Payroll status transition is not allowed'; end if;
end $$;

grant execute on function public.build_weekly_payroll(uuid,date,date,date) to authenticated;
grant execute on function public.set_payroll_status(uuid,uuid,text) to authenticated;

commit;
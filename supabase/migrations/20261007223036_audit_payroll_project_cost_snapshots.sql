begin;

-- Only future builds receive source snapshots. Existing payroll history is not guessed or rewritten.
create or replace function public.build_weekly_payroll(p_company_id uuid,p_period_start date,p_period_end date,p_pay_date date)
returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare v_period uuid; v_missing integer;
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
  if p_period_end < p_period_start or p_period_end-p_period_start > 6 then raise exception 'Payroll period must be one week or less'; end if;
  select count(*) into v_missing from (
    select distinct t.employee_id from public.workforce_time_entries t
    left join public.payroll_employee_settings s on s.company_id=t.company_id and s.employee_id=t.employee_id and s.status='active'
    where t.company_id=p_company_id and t.status='approved' and t.started_at::date between p_period_start and p_period_end and t.ended_at is not null and not exists(select 1 from public.payroll_time_entry_claims c where c.company_id=t.company_id and c.time_entry_id=t.id) and s.id is null
  ) q;
  if v_missing > 0 then raise exception '% employee(s) with approved time need payroll rates before this payroll can be built',v_missing; end if;
  insert into public.payroll_periods(company_id,period_start,period_end,pay_date,status,created_by)
  values(p_company_id,p_period_start,p_period_end,p_pay_date,'draft',auth.uid()) returning id into v_period;

  with raw as (
    select t.employee_id,
      greatest(0,extract(epoch from (t.ended_at-t.started_at))/3600.0 - t.break_minutes/60.0) as hours,
      t.id as time_id,t.project_id
    from public.workforce_time_entries t
    where t.company_id=p_company_id and t.status='approved' and t.ended_at is not null and t.started_at::date between p_period_start and p_period_end and not exists(select 1 from public.payroll_time_entry_claims c where c.company_id=t.company_id and c.time_entry_id=t.id)
  ), agg as (
    select employee_id,sum(hours) hours,array_agg(time_id order by time_id) ids from raw group by employee_id
  )
  insert into public.payroll_lines(company_id,payroll_period_id,employee_id,employee_name,regular_hours,overtime_hours,hourly_rate,overtime_rate,fringe_hourly,regular_pay,overtime_pay,fringe_pay,gross_pay,source_time_entry_ids)
  select p_company_id,v_period,e.id,coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),e.employee_number),
    least(a.hours,40),greatest(a.hours-40,0),s.hourly_rate,s.hourly_rate*s.overtime_multiplier,s.fringe_hourly,
    round((least(a.hours,40)*s.hourly_rate)::numeric,2),round((greatest(a.hours-40,0)*s.hourly_rate*s.overtime_multiplier)::numeric,2),round((a.hours*s.fringe_hourly)::numeric,2),
    round((least(a.hours,40)*s.hourly_rate + greatest(a.hours-40,0)*s.hourly_rate*s.overtime_multiplier + a.hours*s.fringe_hourly)::numeric,2),a.ids
  from agg a join public.employees e on e.id=a.employee_id and e.company_id=p_company_id
  join public.payroll_employee_settings s on s.employee_id=e.id and s.company_id=p_company_id and s.status='active'
  left join public.profiles p on p.id=e.profile_id;

  if not exists(select 1 from public.payroll_lines where payroll_period_id=v_period) then
    raise exception 'No approved unprocessed time is available for this payroll period';
  end if;

  -- Allocate the recorded gross wage by approved net hours, not a later rate.
  -- Largest-remainder cents preserve the exact line gross, even for many small
  -- allocations. Null projects remain explicit unassigned costs. This records
  -- a costing method; it does not assert which project incurred overtime.
  with sources as (
    select l.id line_id,l.gross_pay,t.id time_id,t.project_id,t.started_at,t.ended_at,t.break_minutes,t.approved_at,t.approved_by,
      greatest(0,extract(epoch from (t.ended_at-t.started_at))/3600.0-t.break_minutes/60.0) hours
    from public.payroll_lines l
    join public.workforce_time_entries t on t.company_id=l.company_id and t.employee_id=l.employee_id and t.id=any(l.source_time_entry_ids)
    where l.company_id=p_company_id and l.payroll_period_id=v_period
  ), projects as (
    select line_id,gross_pay,project_id,sum(hours) hours,
      array_agg(time_id order by started_at,time_id) source_ids,
      jsonb_agg(jsonb_build_object('id',time_id,'project_id',project_id,'started_at',started_at,'ended_at',ended_at,'break_minutes',break_minutes,'approved_at',approved_at,'approved_by',approved_by,'net_hours',hours) order by started_at,time_id) source_time
    from sources group by line_id,gross_pay,project_id
  ), shares as (
    select *,case when sum(hours) over(partition by line_id)>0
      then gross_pay*100*hours/sum(hours) over(partition by line_id) else 0 end exact_cents
    from projects
  ), cents as (
    select *,floor(exact_cents) base_cents,
      round(gross_pay*100)-sum(floor(exact_cents)) over(partition by line_id) remainder_cents,
      row_number() over(partition by line_id order by exact_cents-floor(exact_cents) desc,project_id nulls last) remainder_rank
    from shares
  ), snapshots as (
    select line_id,jsonb_agg(jsonb_build_object(
      'version',1,'allocation_method','gross_pay_proportional_approved_hours_v1',
      'source_date_timezone',current_setting('TimeZone'),'project_id',project_id,
      'hours',hours,'gross_pay',(base_cents+case when remainder_rank<=remainder_cents then 1 else 0 end)/100,
      'source_time_entry_ids',source_ids,'source_time_entries',source_time
    ) order by project_id nulls last) allocations
    from cents group by line_id
  )
  update public.payroll_lines l set project_allocations=s.allocations
  from snapshots s where l.id=s.line_id and l.company_id=p_company_id and l.payroll_period_id=v_period;

  update public.payroll_periods pp set
    regular_hours=x.regular_hours,overtime_hours=x.overtime_hours,regular_pay=x.regular_pay,overtime_pay=x.overtime_pay,fringe_pay=x.fringe_pay,gross_pay=x.gross_pay,updated_at=now()
  from (select coalesce(sum(regular_hours),0) regular_hours,coalesce(sum(overtime_hours),0) overtime_hours,coalesce(sum(regular_pay),0) regular_pay,coalesce(sum(overtime_pay),0) overtime_pay,coalesce(sum(fringe_pay),0) fringe_pay,coalesce(sum(gross_pay),0) gross_pay from public.payroll_lines where payroll_period_id=v_period) x
  where pp.id=v_period;
  return v_period;
end $$;

commit;

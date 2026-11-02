begin;

-- Existing periods retain the UTC calendar used by Production. Abort instead
-- of guessing if a recorded historical snapshot demonstrates a different zone.
do $$ begin
  if exists(select 1 from public.payroll_lines l
    cross join lateral jsonb_array_elements(case when jsonb_typeof(l.project_allocations)='array'
      then l.project_allocations else '[]'::jsonb end) a
    where a->>'source_date_timezone' is not null and a->>'source_date_timezone'<>'UTC') then
    raise exception 'Historical non-UTC payroll requires timezone reconciliation before this migration';
  end if;
end $$;
alter table public.payroll_periods add column calendar_timezone text not null default 'UTC';
comment on column public.payroll_periods.calendar_timezone is
  'Immutable payroll start-date calendar. Existing periods retain UTC; new periods snapshot the company timezone.';

CREATE OR REPLACE FUNCTION public.guard_payroll_period_time_claims()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if tg_op='INSERT' then
    select coalesce(nullif(btrim(c.timezone),''),'UTC') into strict new.calendar_timezone
    from public.companies c where c.id=new.company_id;
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.calendar_timezone) then
      raise exception 'Company timezone is invalid';
    end if;
    return new;
  end if;
  if tg_op='DELETE' then
    -- Preserve approved/exported/void history during ordinary payroll edits.
    -- A company deletion remains responsible for its own authorized cascade.
    if old.status not in ('draft','review') and exists(select 1 from public.companies where id=old.company_id) then
      raise exception 'Approved, exported, and void payroll history cannot be deleted';
    end if;
    return old;
  end if;
  if (new.id,new.company_id,new.period_start,new.period_end,new.calendar_timezone) is distinct from
     (old.id,old.company_id,old.period_start,old.period_end,old.calendar_timezone) then
    raise exception 'Payroll period identity and dates are immutable';
  end if;
  if old.status in ('exported','void') then
    if new is distinct from old then raise exception 'Exported and void payroll periods are immutable'; end if;
  elsif new.status is distinct from old.status then
    if not ((new.status='approved' and old.status in ('draft','review'))
      or (new.status='exported' and old.status='approved')
      or (new.status in ('review','void') and old.status not in ('exported','void'))) then
      raise exception 'Payroll status transition is not allowed';
    end if;
    if new.status='void' then
      delete from public.payroll_time_entry_claims c using public.payroll_lines l
      where c.payroll_line_id=l.id and c.company_id=old.company_id
        and l.company_id=old.company_id and l.payroll_period_id=old.id;
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_payroll_line_time_claims()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare v_period public.payroll_periods%rowtype; v_id uuid; v_time public.workforce_time_entries%rowtype;
begin
  select * into v_period from public.payroll_periods
  where id=coalesce(new.payroll_period_id,old.payroll_period_id)
    and company_id=coalesce(new.company_id,old.company_id) for update;
  -- Parent cascade deletion has already removed the parent. Its FK releases claims.
  if tg_op='DELETE' and not found then return old; end if;
  if not found then raise exception 'Payroll period does not belong to this company'; end if;
  if v_period.status not in ('draft','review') then raise exception 'Only draft or review payroll lines can be changed'; end if;
  if tg_op='DELETE' then return old; end if;
  if tg_op='UPDATE' then
    if (new.id,new.company_id,new.payroll_period_id,new.employee_id,new.source_time_entry_ids)
       is distinct from (old.id,old.company_id,old.payroll_period_id,old.employee_id,old.source_time_entry_ids) then
      raise exception 'Payroll source identity is immutable; void and rebuild the period';
    end if;
    return new;
  end if;
  if cardinality(new.source_time_entry_ids)=0 then raise exception 'Payroll lines require approved source time'; end if;
  if cardinality(new.source_time_entry_ids) <> (select count(distinct id) from unnest(new.source_time_entry_ids) id) then
    raise exception 'Payroll source time IDs must be distinct and non-null';
  end if;
  for v_id in select id from unnest(new.source_time_entry_ids) id order by id loop
    select * into v_time from public.workforce_time_entries where id=v_id and company_id=new.company_id for update;
    if not found or v_time.employee_id<>new.employee_id or v_time.status<>'approved' or v_time.ended_at is null
       or (v_time.started_at at time zone v_period.calendar_timezone)::date not between v_period.period_start and v_period.period_end then
      raise exception 'Payroll source time must be approved, completed, and belong to this employee, company, and period';
    end if;
  end loop;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.build_weekly_payroll(p_company_id uuid, p_period_start date, p_period_end date, p_pay_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare v_period uuid; v_missing integer; v_calendar_timezone text;
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
  select coalesce(nullif(btrim(c.timezone),''),'UTC') into strict v_calendar_timezone
  from public.companies c where c.id=p_company_id;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_calendar_timezone) then
    raise exception 'Company timezone is invalid';
  end if;
  if p_period_end < p_period_start or p_period_end-p_period_start > 6 then raise exception 'Payroll period must be one week or less'; end if;
  select count(*) into v_missing from (
    select distinct t.employee_id from public.workforce_time_entries t
    left join public.payroll_employee_settings s on s.company_id=t.company_id and s.employee_id=t.employee_id and s.status='active'
    where t.company_id=p_company_id and t.status='approved' and (t.started_at at time zone v_calendar_timezone)::date between p_period_start and p_period_end and t.ended_at is not null and not exists(select 1 from public.payroll_time_entry_claims c where c.company_id=t.company_id and c.time_entry_id=t.id) and s.id is null
  ) q;
  if v_missing > 0 then raise exception '% employee(s) with approved time need payroll rates before this payroll can be built',v_missing; end if;
  insert into public.payroll_periods(company_id,period_start,period_end,pay_date,status,created_by,calendar_timezone)
  values(p_company_id,p_period_start,p_period_end,p_pay_date,'draft',auth.uid(),v_calendar_timezone) returning id into v_period;

  with raw as (
    select t.employee_id,
      greatest(0,extract(epoch from (t.ended_at-t.started_at))/3600.0 - t.break_minutes/60.0) as hours,
      t.id as time_id,t.project_id
    from public.workforce_time_entries t
    where t.company_id=p_company_id and t.status='approved' and t.ended_at is not null and (t.started_at at time zone v_calendar_timezone)::date between p_period_start and p_period_end and not exists(select 1 from public.payroll_time_entry_claims c where c.company_id=t.company_id and c.time_entry_id=t.id)
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
      'source_date_timezone',v_calendar_timezone,'project_id',project_id,
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
end $function$;

drop trigger payroll_periods_source_guard on public.payroll_periods;
create trigger payroll_periods_source_guard before insert or update or delete on public.payroll_periods
for each row execute function public.guard_payroll_period_time_claims();

-- CREATE OR REPLACE preserves existing grants; no new RPC or definer access.
commit;

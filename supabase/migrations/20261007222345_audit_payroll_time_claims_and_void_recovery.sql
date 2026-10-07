begin;

-- Preserve voided periods and their original source IDs. A new active period may
-- reuse the same date range, but a source time entry can belong to only one active line.
alter table public.payroll_periods drop constraint payroll_periods_company_id_period_start_period_end_key;
create unique index payroll_periods_active_company_dates
  on public.payroll_periods(company_id,period_start,period_end) where status <> 'void';
alter table public.payroll_periods add constraint payroll_periods_id_company_unique unique(id,company_id);
alter table public.payroll_lines add constraint payroll_lines_id_company_unique unique(id,company_id);
alter table public.payroll_lines add constraint payroll_lines_period_company_fkey
  foreign key(payroll_period_id,company_id) references public.payroll_periods(id,company_id) on delete cascade;
create table public.payroll_time_entry_claims (
  company_id uuid not null references public.companies(id) on delete cascade,
  time_entry_id uuid not null,
  payroll_line_id uuid not null,
  primary key(company_id,time_entry_id),
  foreign key(time_entry_id,company_id) references public.workforce_time_entries(id,company_id) on delete restrict,
  foreign key(payroll_line_id,company_id) references public.payroll_lines(id,company_id) on delete cascade
);
create index payroll_time_entry_claims_line on public.payroll_time_entry_claims(payroll_line_id,company_id);

-- Do not silently reconcile conflicting or cross-company historical payroll.
-- Existing active source IDs must satisfy both foreign keys and the unique key.
insert into public.payroll_time_entry_claims(company_id,time_entry_id,payroll_line_id)
select l.company_id,ids.time_entry_id,l.id
from public.payroll_lines l
join public.payroll_periods p on p.id=l.payroll_period_id and p.company_id=l.company_id and p.status <> 'void'
cross join lateral unnest(l.source_time_entry_ids) ids(time_entry_id);

alter table public.payroll_time_entry_claims enable row level security;
revoke all on public.payroll_time_entry_claims from public,anon,authenticated;
grant select,insert,delete on public.payroll_time_entry_claims to authenticated;
create policy payroll_time_claims_select on public.payroll_time_entry_claims
for select to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager']));
-- Only payroll table triggers may create/release claims. Direct Data API writes
-- cannot erase the unique source claim and then reuse already processed time.
create policy payroll_time_claims_insert on public.payroll_time_entry_claims
for insert to authenticated with check (pg_trigger_depth() > 0 and public.has_company_role(company_id,array['owner','administrator','office_manager']));
create policy payroll_time_claims_delete on public.payroll_time_entry_claims
for delete to authenticated using (pg_trigger_depth() > 0 and public.has_company_role(company_id,array['owner','administrator','office_manager']));

create function public.guard_payroll_line_time_claims()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
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
       or v_time.started_at::date not between v_period.period_start and v_period.period_end then
      raise exception 'Payroll source time must be approved, completed, and belong to this employee, company, and period';
    end if;
  end loop;
  return new;
end $$;
create function public.claim_payroll_line_time()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  insert into public.payroll_time_entry_claims(company_id,time_entry_id,payroll_line_id)
  select new.company_id,ids.time_id,new.id from unnest(new.source_time_entry_ids) ids(time_id) order by ids.time_id;
  return new;
exception when unique_violation then
  raise exception 'Approved time is already included in another active payroll period' using errcode='23505';
end $$;
create function public.guard_payroll_period_time_claims()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if tg_op='DELETE' then
    -- Preserve approved/exported/void history during ordinary payroll edits.
    -- A company deletion remains responsible for its own authorized cascade.
    if old.status not in ('draft','review') and exists(select 1 from public.companies where id=old.company_id) then
      raise exception 'Approved, exported, and void payroll history cannot be deleted';
    end if;
    return old;
  end if;
  if (new.id,new.company_id,new.period_start,new.period_end) is distinct from
     (old.id,old.company_id,old.period_start,old.period_end) then
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
end $$;
create trigger payroll_lines_source_guard before insert or update or delete on public.payroll_lines
for each row execute function public.guard_payroll_line_time_claims();
create trigger payroll_lines_claim_time after insert on public.payroll_lines
for each row execute function public.claim_payroll_line_time();
create trigger payroll_periods_source_guard before update or delete on public.payroll_periods
for each row execute function public.guard_payroll_period_time_claims();
revoke all on function public.guard_payroll_line_time_claims() from public,anon,authenticated;
revoke all on function public.claim_payroll_line_time() from public,anon,authenticated;
revoke all on function public.guard_payroll_period_time_claims() from public,anon,authenticated;

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

  update public.payroll_periods pp set
    regular_hours=x.regular_hours,overtime_hours=x.overtime_hours,regular_pay=x.regular_pay,overtime_pay=x.overtime_pay,fringe_pay=x.fringe_pay,gross_pay=x.gross_pay,updated_at=now()
  from (select coalesce(sum(regular_hours),0) regular_hours,coalesce(sum(overtime_hours),0) overtime_hours,coalesce(sum(regular_pay),0) regular_pay,coalesce(sum(overtime_pay),0) overtime_pay,coalesce(sum(fringe_pay),0) fringe_pay,coalesce(sum(gross_pay),0) gross_pay from public.payroll_lines where payroll_period_id=v_period) x
  where pp.id=v_period;
  return v_period;
end $$;

create or replace function public.get_payroll_workspace(p_company_id uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare v_result jsonb;
begin
  if not public.has_company_role(p_company_id,array['owner','administrator','office_manager']) then raise exception 'Not authorized'; end if;
  select jsonb_build_object(
    'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'employee_number',e.employee_number,'name',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),e.employee_number),'position_title',e.position_title,'employment_status',e.employment_status,'hourly_rate',s.hourly_rate,'overtime_multiplier',s.overtime_multiplier,'fringe_hourly',s.fringe_hourly,'provider',s.provider,'provider_employee_id',s.provider_employee_id,'payroll_ready',(s.id is not null and s.status='active')) order by e.employee_number) from public.employees e left join public.profiles p on p.id=e.profile_id left join public.payroll_employee_settings s on s.company_id=e.company_id and s.employee_id=e.id where e.company_id=p_company_id and e.employment_status='active'),'[]'::jsonb),
    'periods',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'period_start',x.period_start,'period_end',x.period_end,'pay_date',x.pay_date,'status',x.status,'regular_hours',x.regular_hours,'overtime_hours',x.overtime_hours,'regular_pay',x.regular_pay,'overtime_pay',x.overtime_pay,'fringe_pay',x.fringe_pay,'gross_pay',x.gross_pay,'approved_at',x.approved_at,'exported_at',x.exported_at) order by x.period_end desc) from (select * from public.payroll_periods where company_id=p_company_id order by period_end desc limit 20) x),'[]'::jsonb),
    'approved_unprocessed_hours',coalesce((select round(sum(greatest(0,extract(epoch from (t.ended_at-t.started_at))/3600.0-t.break_minutes/60.0))::numeric,2) from public.workforce_time_entries t where t.company_id=p_company_id and t.status='approved' and t.ended_at is not null and not exists(select 1 from public.payroll_time_entry_claims c where c.company_id=p_company_id and c.time_entry_id=t.id)),0),
    'employees_needing_rates',coalesce((select count(*) from public.employees e left join public.payroll_employee_settings s on s.company_id=e.company_id and s.employee_id=e.id and s.status='active' where e.company_id=p_company_id and e.employment_status='active' and s.id is null),0)
  ) into v_result;
  return v_result;
end $$;

revoke all on function public.build_weekly_payroll(uuid,date,date,date) from public,anon;
revoke all on function public.get_payroll_workspace(uuid) from public,anon;
grant execute on function public.build_weekly_payroll(uuid,date,date,date) to authenticated;
grant execute on function public.get_payroll_workspace(uuid) to authenticated;
commit;

begin;

alter table public.workforce_assignments
  add column schedule_kind text,
  add column required_headcount integer check (required_headcount > 0),
  add column required_trade text,
  add column creation_request_hash text,
  add constraint workforce_assignments_schedule_kind_check check (
    schedule_kind is null or schedule_kind in ('project_work','crew_mobilization','inspection','delivery','training','toolbox_talk','maintenance','meeting','milestone','time_off','open_shift')
  );

-- Invoker preserves the existing workforce and compensation RLS policies.
-- No service key, new table, policy changes, or historical backfill.
create function public.create_schedule_assignment_atomic(
  p_company_id uuid, p_request_id uuid, p_assignment jsonb, p_compensation jsonb default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_existing public.workforce_assignments;
  v_request jsonb := jsonb_build_object('assignment',p_assignment,'compensation',p_compensation);
  v_project uuid := (p_assignment->>'project_id')::uuid;
  v_crew uuid := nullif(p_assignment->>'crew_id','')::uuid;
  v_employee uuid := nullif(p_assignment->>'employee_id','')::uuid;
  v_start timestamptz := (p_assignment->>'starts_at')::timestamptz;
  v_end timestamptz := (p_assignment->>'ends_at')::timestamptz;
  v_hours numeric;
  v_member record;
  v_count integer := 0;
  v_method text := p_compensation->>'method';
begin
  if auth.uid() is null or not public.has_company_role(p_company_id,array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']) then
    raise exception 'Not authorized';
  end if;
  if p_request_id is null or p_assignment is null or jsonb_typeof(p_assignment) <> 'object' then
    raise exception 'A valid assignment request is required';
  end if;
  -- Serialize retries first, then bookings of the same resource, including different request IDs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule-request:'||p_request_id::text,0));
  select * into v_existing from public.workforce_assignments where id=p_request_id and company_id=p_company_id;
  if found then
    if v_existing.creation_request_hash is distinct from pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_request::text,'UTF8')),'hex') then raise exception 'This request already saved different assignment details'; end if;
    return v_existing.id;
  end if;
  if v_start is null or v_end is null or not pg_catalog.isfinite(v_start) or not pg_catalog.isfinite(v_end) or v_end <= v_start then raise exception 'Enter a valid assignment start and end time'; end if;
  if ((v_crew is not null)::integer + (v_employee is not null)::integer) <> 1 then raise exception 'Select exactly one crew or employee'; end if;
  if not exists(select 1 from public.projects where company_id=p_company_id and id=v_project) then raise exception 'Project not found'; end if;
  if v_crew is not null and not exists(select 1 from public.crews where company_id=p_company_id and id=v_crew) then raise exception 'Crew not found'; end if;
  if v_employee is not null and not exists(select 1 from public.employees where company_id=p_company_id and id=v_employee) then raise exception 'Employee not found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule-resource:'||p_company_id::text||':'||coalesce(v_crew,v_employee)::text,0));
  if exists(select 1 from public.workforce_assignments where company_id=p_company_id
    and status in ('planned','confirmed','in_progress') and (crew_id=v_crew or employee_id=v_employee)
    and starts_at<v_end and ends_at>v_start) then raise exception 'Assignment conflicts with an existing schedule for this resource.'; end if;
  v_hours := round(extract(epoch from (v_end-v_start))/3600,2);
  insert into public.workforce_assignments(id,company_id,assignment_type,crew_id,employee_id,project_id,title,description,notes,starts_at,ends_at,planned_hours,status,source_type,schedule_kind,required_headcount,required_trade,creation_request_hash,created_by,updated_by)
  values(p_request_id,p_company_id,case when v_crew is not null then 'crew' else 'employee' end,v_crew,v_employee,v_project,
    btrim(p_assignment->>'title'),nullif(p_assignment->>'notes',''),nullif(p_assignment->>'notes',''),v_start,v_end,v_hours,
    p_assignment->>'status','manual',p_assignment->>'schedule_kind',coalesce((p_assignment->>'required_headcount')::integer,1),nullif(p_assignment->>'required_trade',''),pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_request::text,'UTF8')),'hex'),auth.uid(),auth.uid());

  if p_compensation is not null then
    if jsonb_typeof(p_compensation) <> 'object' or v_crew is null then raise exception 'Crew compensation requires a crew assignment'; end if;
    if not public.has_company_role(p_company_id,array['owner','administrator','office_manager','project_manager']) then raise exception 'Not authorized to commit project labor'; end if;
    if v_method is null or v_method not in ('payroll_rate','hourly','prevailing_wage','day_rate','piece_rate','lump_sum') then raise exception 'Unsupported compensation method'; end if;
    if v_method <> 'payroll_rate' and (jsonb_typeof(p_compensation->'rate') is distinct from 'number' or (p_compensation->>'rate')::numeric < 0) then raise exception 'Enter a valid compensation rate'; end if;
    if v_method in ('day_rate','piece_rate','lump_sum') and (jsonb_typeof(p_compensation->case v_method when 'day_rate' then 'days' when 'piece_rate' then 'units' else 'lumpSum' end) is distinct from 'number' or (p_compensation->>case v_method when 'day_rate' then 'days' when 'piece_rate' then 'units' else 'lumpSum' end)::numeric <= 0) then raise exception 'Enter a positive compensation quantity'; end if;
    -- Serialize pooled plan updates for this project; preserve existing actual fields.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('project-labor:'||p_company_id::text||':'||v_project::text,0));
    if v_method='payroll_rate' then
      for v_member in
        select distinct m.employee_id,s.hourly_rate,s.fringe_hourly from public.crew_memberships m
        join public.employees e on e.company_id=m.company_id and e.id=m.employee_id
        left join public.payroll_employee_settings s on s.company_id=m.company_id and s.employee_id=m.employee_id and s.status='active'
        where m.company_id=p_company_id and m.crew_id=v_crew and m.status='active'
      loop
        v_count := v_count+1;
        if v_member.hourly_rate is null then raise exception 'Every active crew member needs an employee pay rate before using Payroll rates'; end if;
        perform public.save_project_labor_commitment(p_company_id,v_project,v_member.employee_id,null,'payroll_rate',v_member.hourly_rate+coalesce(v_member.fringe_hourly,0),v_hours,0,0,0,jsonb_build_object('crewId',v_crew),p_assignment->>'notes');
      end loop;
      if v_count=0 then raise exception 'This crew has no active members with payroll setup.'; end if;
    else
      perform public.save_project_labor_commitment(p_company_id,v_project,null,v_crew,v_method,
        coalesce((p_compensation->>'rate')::numeric,0),case when v_method in ('hourly','prevailing_wage') then v_hours else 0 end,
        case when v_method='day_rate' then (p_compensation->>'days')::numeric else 0 end,
        case when v_method='piece_rate' then (p_compensation->>'units')::numeric else 0 end,
        case when v_method='lump_sum' then (p_compensation->>'lumpSum')::numeric else 0 end,
        jsonb_build_object('crewId',v_crew),p_assignment->>'notes');
    end if;
  end if;
  return p_request_id;
end $$;
revoke all on function public.create_schedule_assignment_atomic(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.create_schedule_assignment_atomic(uuid,uuid,jsonb,jsonb) to authenticated;

commit;

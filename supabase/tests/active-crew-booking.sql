-- Run with the migration in ONE transaction; always ROLLBACK.
-- Only the labelled pilot's company/project is read. All probe crews/bookings/plans roll back.
create temp table active_crew_context as
select p.company_id,p.id user_id,j.id project_id,gen_random_uuid() crew_id,gen_random_uuid() request_id
from public.profiles p join public.company_memberships m on m.user_id=p.id and m.company_id=p.company_id
join public.projects j on j.company_id=p.company_id and j.name='BOS Pilot 20261019 — synthetic project'
where m.role='owner' and m.status='active' limit 1;
grant select on active_crew_context to authenticated;

do $test$
declare c record; a jsonb; pay jsonb := '{"method":"hourly","rate":10}';
  crew_status text; booking_status text; rejected boolean; probe uuid; saved_id uuid; original_plan jsonb;
begin
  select * into strict c from active_crew_context;
  select jsonb_agg(to_jsonb(l) order by l.id) into original_plan from public.project_labor_commitments l
    where project_id=c.project_id and company_id=c.company_id;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',c.user_id)::text,true);
  execute 'set local role authenticated';
  insert into public.crews(id,company_id,crew_code,name,status,created_by,updated_by)
    values(c.crew_id,c.company_id,'BOS-ACTIVE-'||c.crew_id::text,'BOS ACTIVE CREW ROLLBACK ONLY','active',c.user_id,c.user_id);
  a:=jsonb_build_object('project_id',c.project_id,'crew_id',c.crew_id,'employee_id',null,
    'title','BOS ACTIVE CREW ROLLBACK ONLY','starts_at','2036-02-03T13:00:00Z','ends_at','2036-02-03T15:00:00Z',
    'status','confirmed','schedule_kind','project_work','required_headcount',1);
  foreach crew_status in array array['inactive','archived'] loop
    update public.crews set status=crew_status where id=c.crew_id and company_id=c.company_id;
    foreach booking_status in array array['planned','confirmed','in_progress'] loop
      probe:=gen_random_uuid(); rejected:=false;
      begin
        perform public.create_schedule_assignment_atomic(c.company_id,probe,a||jsonb_build_object('status',booking_status),pay);
      exception when check_violation then rejected:=sqlerrm like 'Only active crews%'; end;
      if not rejected or exists(select 1 from public.workforce_assignments where id=probe)
        or exists(select 1 from public.project_labor_commitments where crew_id=c.crew_id) then
        raise exception 'Inactive/archived RPC booking was accepted or left financial/schedule rows';
      end if;
    end loop;
    rejected:=false;
    begin
      insert into public.workforce_assignments(company_id,project_id,crew_id,assignment_type,title,starts_at,ends_at,status,source_type,created_by,updated_by)
        values(c.company_id,c.project_id,c.crew_id,'crew','BOS DIRECT CREW ROLLBACK ONLY','2036-02-04T13:00:00Z','2036-02-04T15:00:00Z','confirmed','manual',c.user_id,c.user_id);
    exception when check_violation then rejected:=sqlerrm like 'Only active crews%'; end;
    if not rejected then raise exception 'Direct table write bypassed crew status guard'; end if;
  end loop;
  update public.crews set status='active' where id=c.crew_id and company_id=c.company_id;
  saved_id:=public.create_schedule_assignment_atomic(c.company_id,c.request_id,a,pay);
  if saved_id<>c.request_id
    or not exists(select 1 from public.project_labor_commitments where crew_id=c.crew_id and projected_cost=20 and actual_cost=0) then
    raise exception 'Active crew positive control failed';
  end if;
  update public.crews set status='archived' where id=c.crew_id and company_id=c.company_id;
  if public.create_schedule_assignment_atomic(c.company_id,c.request_id,a,pay)<>c.request_id then
    raise exception 'Existing saved-request replay should remain a read of the original booking';
  end if;
  update public.workforce_assignments set notes='BOS retained history note' where id=c.request_id;
  rejected:=false;
  begin update public.workforce_assignments set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day' where id=c.request_id;
  exception when check_violation then rejected:=sqlerrm like 'Only active crews%'; end;
  if not rejected then raise exception 'Rescheduling an archived crew bypassed the guard'; end if;
  rejected:=false;
  begin update public.workforce_assignments set status='in_progress' where id=c.request_id;
  exception when check_violation then rejected:=sqlerrm like 'Only active crews%'; end;
  if not rejected then raise exception 'Advancing an archived crew booking bypassed the guard'; end if;
  update public.workforce_assignments set status='cancelled' where id=c.request_id;
  update public.workforce_assignments set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day' where id=c.request_id;
  rejected:=false;
  begin update public.workforce_assignments set status='confirmed' where id=c.request_id;
  exception when check_violation then rejected:=sqlerrm like 'Only active crews%'; end;
  if not rejected then raise exception 'Reactivating a cancelled archived-crew booking bypassed the guard'; end if;
  if original_plan is distinct from (select jsonb_agg(to_jsonb(l) order by l.id)
      from public.project_labor_commitments l where project_id=c.project_id and company_id=c.company_id and crew_id is distinct from c.crew_id) then
    raise exception 'Existing pilot finance plan changed';
  end if;
  if (select prosecdef from pg_proc where oid='public.enforce_active_crew_booking()'::regprocedure)
    or has_function_privilege('anon','public.enforce_active_crew_booking()','execute')
    or has_function_privilege('authenticated','public.enforce_active_crew_booking()','execute') then
    raise exception 'Trigger helper must remain invoker and non-executable through RPC';
  end if;
end;
$test$;

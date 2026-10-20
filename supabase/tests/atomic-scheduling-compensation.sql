-- Run after the migration in ONE transaction and always ROLLBACK.
-- Uses only the explicitly labelled synthetic pilot; no real payments or payroll runs.
create temp table schedule_atomic_context as
select p.company_id,p.id user_id,j.id project_id,c.id crew_id,gen_random_uuid() request_id
from public.profiles p join public.company_memberships m on m.user_id=p.id and m.company_id=p.company_id
join public.projects j on j.company_id=p.company_id and j.name='BOS Pilot 20261019 — synthetic project'
join public.crews c on c.company_id=p.company_id and c.name='BOS Pilot Crew 20261019 — synthetic'
where m.role='owner' and m.status='active' limit 1;
grant select on schedule_atomic_context to authenticated;
create function pg_temp.schedule_compensation_fault() returns trigger language plpgsql as $$
begin
  if new.notes='BOS ATOMIC PAYROLL FAULT' and exists(select 1 from public.project_labor_commitments where company_id=new.company_id and project_id=new.project_id and notes=new.notes) then raise exception 'Synthetic second payroll fault'; end if;
  if new.notes='BOS ATOMIC SCHEDULING FAULT' then raise exception 'Synthetic compensation fault'; end if;
  return new;
end $$;
create trigger schedule_compensation_fault before insert or update on public.project_labor_commitments
for each row execute function pg_temp.schedule_compensation_fault();

do $$
declare c record; a jsonb; pay jsonb; v_saved_id uuid; failed boolean; before_plan jsonb; n integer; e1 uuid:=gen_random_uuid(); e2 uuid:=gen_random_uuid();
begin
  select * into strict c from schedule_atomic_context;
  select jsonb_agg(to_jsonb(l) order by l.id) into before_plan from public.project_labor_commitments l where company_id=c.company_id and project_id=c.project_id;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',c.user_id)::text,true);
  execute 'set local role authenticated';
  a:=jsonb_build_object('project_id',c.project_id,'crew_id',c.crew_id,'employee_id',null,'title','BOS Atomic scheduling transactional test','notes','BOS ATOMIC SCHEDULING FAULT','starts_at','2036-01-08T13:00:00Z','ends_at','2036-01-08T15:00:00Z','status','confirmed','schedule_kind','project_work','required_headcount',3,'required_trade','General Labor');
  pay:='{"method":"hourly","rate":15,"days":1,"units":0,"lumpSum":0}';
  failed:=false;
  begin perform public.create_schedule_assignment_atomic(c.company_id,c.request_id,a,pay);
  exception when others then failed:=sqlerrm='Synthetic compensation fault'; end;
  if not failed or exists(select 1 from public.workforce_assignments where id=c.request_id) then raise exception 'Compensation failure left an assignment'; end if;
  if before_plan is distinct from (select jsonb_agg(to_jsonb(l) order by l.id) from public.project_labor_commitments l where company_id=c.company_id and project_id=c.project_id) then raise exception 'Failed save changed the existing plan'; end if;

  a:=a||'{"notes":"BOS atomic rollback-only test"}';
  v_saved_id:=public.create_schedule_assignment_atomic(c.company_id,c.request_id,a,pay);
  if v_saved_id<>c.request_id or not exists(select 1 from public.workforce_assignments where workforce_assignments.id=c.request_id and company_id=c.company_id and schedule_kind='project_work' and status='confirmed' and planned_hours=2 and required_headcount=3 and required_trade='General Labor') then raise exception 'Assignment round-trip failed'; end if;
  if not exists(select 1 from public.project_labor_commitments where company_id=c.company_id and project_id=c.project_id and crew_id=c.crew_id and projected_cost=30 and actual_cost=0) then raise exception 'Compensation did not commit with assignment'; end if;
  if public.create_schedule_assignment_atomic(c.company_id,c.request_id,a,pay)<>v_saved_id then raise exception 'Replay returned another ID'; end if;
  select count(*) into n from public.workforce_assignments where id=c.request_id;
  if n<>1 then raise exception 'Replay duplicated assignment'; end if;
  failed:=false;
  begin perform public.create_schedule_assignment_atomic(c.company_id,c.request_id,a||'{"title":"Changed retry"}',pay);
  exception when others then failed:=sqlerrm='This request already saved different assignment details'; end;
  if not failed then raise exception 'Mismatched retry accepted'; end if;
  failed:=false;
  begin perform public.create_schedule_assignment_atomic(c.company_id,gen_random_uuid(),a,pay);
  exception when others then failed:=sqlerrm='Assignment conflicts with an existing schedule for this resource.'; end;
  if not failed then raise exception 'Overlapping create accepted'; end if;

  update public.workforce_assignments set status='cancelled',updated_by=c.user_id where id=c.request_id;
  -- A cancelled historical row must not prevent a new booking in the same slot.
  v_saved_id:=public.create_schedule_assignment_atomic(c.company_id,gen_random_uuid(),a,null);
  if not exists(select 1 from public.workforce_assignments w where w.id=v_saved_id and w.status='confirmed') then raise exception 'Cancelled history blocked booking'; end if;

  a:=a||'{"starts_at":"2036-01-09T13:00:00Z","ends_at":"2036-01-09T15:00:00Z"}';
  v_saved_id:=gen_random_uuid(); failed:=false;
  begin perform public.create_schedule_assignment_atomic(c.company_id,v_saved_id,a,'{"method":"piece_rate","rate":15,"units":-1}');
  exception when others then failed:=sqlerrm='Enter a positive compensation quantity'; end;
  if not failed or exists(select 1 from public.workforce_assignments w where w.id=v_saved_id) then raise exception 'Invalid compensation left a booking'; end if;
  v_saved_id:=gen_random_uuid(); failed:=false;
  begin perform public.create_schedule_assignment_atomic(c.company_id,v_saved_id,a,'{"method":"payroll_rate"}');
  exception when others then failed:=sqlerrm='This crew has no active members with payroll setup.'; end;
  if not failed or exists(select 1 from public.workforce_assignments w where w.id=v_saved_id) then raise exception 'Empty payroll crew left a booking'; end if;

  -- Build temporary employees/pay settings inside the outer rollback only.
  execute 'reset role';
  insert into public.employees(id,company_id,employee_number,position_title,hire_date) values
    (e1,c.company_id,'ATOMIC-'||e1::text,'Rollback-only payroll fixture',current_date),
    (e2,c.company_id,'ATOMIC-'||e2::text,'Rollback-only payroll fixture',current_date);
  insert into public.crew_memberships(company_id,crew_id,employee_id,role,starts_on,status) values
    (c.company_id,c.crew_id,e1,'member',current_date,'active'),(c.company_id,c.crew_id,e2,'member',current_date,'active');
  insert into public.payroll_employee_settings(company_id,employee_id,hourly_rate,fringe_hourly) values
    (c.company_id,e1,20,2),(c.company_id,e2,30,0);
  execute 'set local role authenticated';
  a:=a||'{"notes":"BOS ATOMIC PAYROLL FAULT"}';
  v_saved_id:=gen_random_uuid(); failed:=false;
  begin perform public.create_schedule_assignment_atomic(c.company_id,v_saved_id,a,'{"method":"payroll_rate","rate":999}');
  exception when others then failed:=sqlerrm='Synthetic second payroll fault'; end;
  if not failed or exists(select 1 from public.workforce_assignments w where w.id=v_saved_id)
    or exists(select 1 from public.project_labor_commitments where company_id=c.company_id and project_id=c.project_id and employee_id in (e1,e2)) then raise exception 'Second payroll failure left partial assignment or compensation'; end if;
  a:=a||'{"notes":"BOS ATOMIC PAYROLL SUCCESS"}';
  v_saved_id:=public.create_schedule_assignment_atomic(c.company_id,v_saved_id,a,'{"method":"payroll_rate","rate":999}');
  if (select sum(projected_cost) from public.project_labor_commitments where company_id=c.company_id and project_id=c.project_id and employee_id in (e1,e2))<>104 then raise exception 'Server payroll rate/fringe snapshot incorrect'; end if;

  failed:=false;
  begin perform public.create_schedule_assignment_atomic(gen_random_uuid(),gen_random_uuid(),a,null);
  exception when others then failed:=sqlerrm='Not authorized'; end;
  if not failed then raise exception 'Cross-company create accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid())::text,true);
  failed:=false;
  begin perform public.create_schedule_assignment_atomic(c.company_id,gen_random_uuid(),a,null);
  exception when others then failed:=sqlerrm='Not authorized'; end;
  if not failed then raise exception 'Nonmember create accepted'; end if;
  execute 'reset role';
  if has_function_privilege('anon','public.create_schedule_assignment_atomic(uuid,uuid,jsonb,jsonb)','execute') then raise exception 'Anonymous RPC execution granted'; end if;
  if (select prosecdef from pg_proc where oid='public.create_schedule_assignment_atomic(uuid,uuid,jsonb,jsonb)'::regprocedure) then raise exception 'RPC bypasses RLS'; end if;
end $$;
select 'PASS: atomic rollback, existing plan preservation, authenticated RLS, round-trip, replay, mismatched retry, overlap, cancellation, invalid compensation, empty payroll, company/nonmember isolation and anonymous grants' as result;

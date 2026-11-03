begin;

-- Self-service clock-out requires UPDATE permission; the existing RLS allowed
-- employee INSERT and SELECT, but reserved all UPDATEs for managers.
-- This policy is deliberately restricted to the open -> submitted transition.
create policy workforce_time_entries_employee_clock_out
on public.workforce_time_entries
for update to authenticated
using (
  status='open'
  and public.is_company_member(company_id)
  and exists (
    select 1 from public.employees e
    where e.id=workforce_time_entries.employee_id
      and e.company_id=workforce_time_entries.company_id
      and e.profile_id=(select auth.uid())
  )
)
with check (
  status='submitted'
  and public.is_company_member(company_id)
  and exists (
    select 1 from public.employees e
    where e.id=workforce_time_entries.employee_id
      and e.company_id=workforce_time_entries.company_id
      and e.profile_id=(select auth.uid())
  )
);

-- RLS cannot compare OLD and NEW. This invoker trigger prevents workers
-- from using direct Data API writes to forge past hours, edit assignments,
-- modify approved time, or supply a fictitious clock-out timestamp.
create function public.guard_workforce_self_time_write()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
declare
  v_manager boolean;
  v_is_self boolean;
begin
  if current_user='service_role' then
    return new;
  end if;

  v_manager := public.has_company_role(new.company_id,
    array['owner','administrator','operations_manager','project_manager',
          'superintendent','foreman','office_manager']);
  if v_manager then
    return new;
  end if;

  v_is_self := exists (
    select 1 from public.employees e
    where e.id=new.employee_id and e.company_id=new.company_id
      and e.profile_id=auth.uid()
  );
  if not v_is_self then
    raise exception 'Not authorized to modify this employee time';
  end if;

  if tg_op='INSERT' then
    if new.status <> 'open'
       or new.ended_at is not null or new.approved_by is not null
       or new.approved_at is not null or new.source <> 'mobile'
       or new.created_by is distinct from auth.uid()
       or new.break_minutes <> 0
       or new.clock_out_location is not null then
      raise exception 'Employees may only create an open mobile time entry';
    end if;
    new.started_at := statement_timestamp();
    new.updated_at := statement_timestamp();
    return new;
  end if;

  if old.status <> 'open' or new.status <> 'submitted'
     or (new.id,new.company_id,new.employee_id,new.project_id,
         new.assignment_id,new.started_at,new.source,new.created_by,
         new.created_at,new.clock_in_location,new.approved_by,new.approved_at)
        is distinct from
        (old.id,old.company_id,old.employee_id,old.project_id,
         old.assignment_id,old.started_at,old.source,old.created_by,
         old.created_at,old.clock_in_location,old.approved_by,old.approved_at)
     or new.break_minutes < 0 or new.break_minutes > 1440 then
    raise exception 'Employees may only submit their own open time without changing assignment or identity';
  end if;

  new.ended_at := statement_timestamp();
  new.updated_at := statement_timestamp();
  if new.ended_at < new.started_at then
    raise exception 'Clock-out must occur after clock-in';
  end if;
  return new;
end $$;

revoke all on function public.guard_workforce_self_time_write()
from public, anon, authenticated;

create trigger workforce_self_time_write_guard
before insert or update on public.workforce_time_entries
for each row execute function public.guard_workforce_self_time_write();

commit;

begin;

-- Keep time charged to a specific assignment consistent with the employee,
-- assigned crew, and assigned project. Entries without an assignment remain
-- valid for legitimately unassigned/manual job time.
create function public.guard_workforce_time_assignment_link()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
declare
  v_assignment public.workforce_assignments%rowtype;
begin
  if new.assignment_id is null then return new; end if;

  select a.* into v_assignment
    from public.workforce_assignments a
   where a.id=new.assignment_id and a.company_id=new.company_id;

  if not found then
    raise exception 'The selected workforce assignment is not available for this company';
  end if;
  if v_assignment.project_id is distinct from new.project_id then
    raise exception 'Time entry project must match the workforce assignment project';
  end if;

  if v_assignment.assignment_type='employee' then
    if v_assignment.employee_id is distinct from new.employee_id then
      raise exception 'Employee does not belong to the selected workforce assignment';
    end if;
  elsif v_assignment.assignment_type='crew' then
    if not exists (
      select 1 from public.crew_memberships m
       where m.company_id=new.company_id
         and m.crew_id=v_assignment.crew_id
         and m.employee_id=new.employee_id
         and m.status='active'
         and m.starts_on <= (new.started_at at time zone 'UTC')::date
         and (m.ends_on is null or m.ends_on >= (new.started_at at time zone 'UTC')::date)
    ) then
      raise exception 'Employee is not an active member of the selected crew assignment';
    end if;
  else
    raise exception 'Unsupported workforce assignment type';
  end if;

  return new;
end $$;

revoke all on function public.guard_workforce_time_assignment_link() from public, anon, authenticated;

create trigger workforce_time_assignment_link_guard
before insert or update of company_id, employee_id, project_id, assignment_id
on public.workforce_time_entries
for each row execute function public.guard_workforce_time_assignment_link();

commit;

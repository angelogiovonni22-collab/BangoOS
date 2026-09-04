-- Harden project task dependencies so dependency graphs cannot cross projects
-- or form circular chains, regardless of which client writes the relationship.

create or replace function public.validate_task_dependency_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task_company_id uuid;
  v_task_project_id uuid;
  v_dependency_company_id uuid;
  v_dependency_project_id uuid;
  v_cycle_exists boolean := false;
begin
  select company_id, project_id
    into v_task_company_id, v_task_project_id
  from public.tasks
  where id = new.task_id;

  select company_id, project_id
    into v_dependency_company_id, v_dependency_project_id
  from public.tasks
  where id = new.depends_on_task_id;

  if v_task_company_id is null or v_dependency_company_id is null then
    raise exception 'Task dependency references an unknown task.' using errcode = '23503';
  end if;

  if new.company_id <> v_task_company_id
     or new.company_id <> v_dependency_company_id then
    raise exception 'Task dependency company must match both tasks.' using errcode = '23514';
  end if;

  if v_task_project_id <> v_dependency_project_id then
    raise exception 'Task dependencies must stay within one project.' using errcode = '23514';
  end if;

  if new.task_id = new.depends_on_task_id then
    raise exception 'A task cannot depend on itself.' using errcode = '23514';
  end if;

  with recursive dependency_walk(task_id) as (
    select new.depends_on_task_id
    union
    select td.depends_on_task_id
    from public.task_dependencies td
    join dependency_walk walk on td.task_id = walk.task_id
    where td.company_id = new.company_id
      and td.id is distinct from new.id
  )
  select exists (
    select 1
    from dependency_walk
    where task_id = new.task_id
  )
  into v_cycle_exists;

  if v_cycle_exists then
    raise exception 'Task dependency would create a circular dependency.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_task_dependency_integrity() from public;
revoke all on function public.validate_task_dependency_integrity() from anon;
revoke all on function public.validate_task_dependency_integrity() from authenticated;

drop trigger if exists task_dependencies_validate_integrity on public.task_dependencies;
create trigger task_dependencies_validate_integrity
before insert or update of company_id, task_id, depends_on_task_id
on public.task_dependencies
for each row
execute function public.validate_task_dependency_integrity();

comment on function public.validate_task_dependency_integrity() is
  'Enforces same-company, same-project, non-self, acyclic task dependency relationships.';

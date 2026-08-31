begin;

create or replace function private.can_access_internal_project(
  p_company_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_bos_platform_admin())
    or exists (
      select 1
      from public.company_memberships membership
      where membership.company_id = p_company_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in (
          'owner', 'administrator', 'operations_manager', 'project_manager',
          'estimator', 'superintendent', 'office_manager', 'accountant'
        )
    )
    or exists (
      select 1
      from public.company_memberships membership
      join public.employees employee
        on employee.company_id = membership.company_id
       and employee.profile_id = membership.user_id
      where membership.company_id = p_company_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('foreman', 'employee')
        and (
          exists (
            select 1
            from public.workforce_assignments assignment
            where assignment.company_id = p_company_id
              and assignment.project_id = p_project_id
              and assignment.employee_id = employee.id
              and assignment.status <> 'cancelled'
          )
          or exists (
            select 1
            from public.crew_memberships crew_member
            join public.workforce_assignments assignment
              on assignment.company_id = crew_member.company_id
             and assignment.crew_id = crew_member.crew_id
             and assignment.project_id = p_project_id
             and assignment.status <> 'cancelled'
            where crew_member.company_id = p_company_id
              and crew_member.employee_id = employee.id
              and crew_member.status = 'active'
          )
        )
    );
$$;

revoke all on function private.can_access_internal_project(uuid, uuid) from public;
grant execute on function private.can_access_internal_project(uuid, uuid) to authenticated;

drop policy if exists projects_select on public.projects;
create policy projects_select
on public.projects
for select
to authenticated
using ((select private.can_access_internal_project(projects.company_id, projects.id)));

drop policy if exists projects_insert on public.projects;
create policy projects_insert
on public.projects
for insert
to authenticated
with check (
  public.has_company_role(
    projects.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager']
  )
  and (
    projects.customer_id is null
    or exists (
      select 1 from public.customers customer
      where customer.id = projects.customer_id
        and customer.company_id = projects.company_id
    )
  )
);

drop policy if exists projects_update on public.projects;
create policy projects_update
on public.projects
for update
to authenticated
using (
  public.has_company_role(
    projects.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager']
  )
)
with check (
  public.has_company_role(
    projects.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager']
  )
  and (
    projects.customer_id is null
    or exists (
      select 1 from public.customers customer
      where customer.id = projects.customer_id
        and customer.company_id = projects.company_id
    )
  )
);

drop policy if exists projects_delete on public.projects;
create policy projects_delete
on public.projects
for delete
to authenticated
using (
  public.has_company_role(
    projects.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager']
  )
);

commit;

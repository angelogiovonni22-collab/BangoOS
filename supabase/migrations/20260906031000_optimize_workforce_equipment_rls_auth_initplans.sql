-- Cache auth.uid() once per statement across Workforce and Equipment RLS.
-- Existing tenant membership, role sets, ownership metadata checks, and write
-- permissions are preserved exactly; only auth evaluation is optimized.

-- Employees

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select to authenticated
  using (public.is_company_member(company_id, (select auth.uid())));

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert to authenticated
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid()))
    and (created_by is null or created_by = (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
  for update to authenticated
  using (public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid())))
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

-- Crews

drop policy if exists crews_select on public.crews;
create policy crews_select on public.crews
  for select to authenticated
  using (public.is_company_member(company_id, (select auth.uid())));

drop policy if exists crews_insert on public.crews;
create policy crews_insert on public.crews
  for insert to authenticated
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid()))
    and (created_by is null or created_by = (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

drop policy if exists crews_update on public.crews;
create policy crews_update on public.crews
  for update to authenticated
  using (public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid())))
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

-- Crew memberships

drop policy if exists crew_memberships_select on public.crew_memberships;
create policy crew_memberships_select on public.crew_memberships
  for select to authenticated
  using (public.is_company_member(company_id, (select auth.uid())));

drop policy if exists crew_memberships_insert on public.crew_memberships;
create policy crew_memberships_insert on public.crew_memberships
  for insert to authenticated
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid()))
    and (created_by is null or created_by = (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

drop policy if exists crew_memberships_update on public.crew_memberships;
create policy crew_memberships_update on public.crew_memberships
  for update to authenticated
  using (public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid())))
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

-- Workforce assignments

drop policy if exists workforce_assignments_select on public.workforce_assignments;
create policy workforce_assignments_select on public.workforce_assignments
  for select to authenticated
  using (public.is_company_member(company_id, (select auth.uid())));

drop policy if exists workforce_assignments_insert on public.workforce_assignments;
create policy workforce_assignments_insert on public.workforce_assignments
  for insert to authenticated
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid()))
    and (created_by is null or created_by = (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

drop policy if exists workforce_assignments_update on public.workforce_assignments;
create policy workforce_assignments_update on public.workforce_assignments
  for update to authenticated
  using (public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid())))
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','project_manager','superintendent','foreman','office_manager']::text[], (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

-- Equipment

drop policy if exists equipment_select on public.equipment;
create policy equipment_select on public.equipment
  for select to authenticated
  using (public.is_company_member(company_id, (select auth.uid())));

drop policy if exists equipment_insert on public.equipment;
create policy equipment_insert on public.equipment
  for insert to authenticated
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','office_manager','accountant','estimator']::text[], (select auth.uid()))
    and (created_by is null or created_by = (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

drop policy if exists equipment_update on public.equipment;
create policy equipment_update on public.equipment
  for update to authenticated
  using (public.has_company_role(company_id, array['owner','administrator','operations_manager','office_manager','accountant','estimator']::text[], (select auth.uid())))
  with check (
    public.has_company_role(company_id, array['owner','administrator','operations_manager','office_manager','accountant','estimator']::text[], (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

drop policy if exists equipment_delete on public.equipment;
create policy equipment_delete on public.equipment
  for delete to authenticated
  using (public.has_company_role(company_id, array['owner','administrator']::text[], (select auth.uid())));

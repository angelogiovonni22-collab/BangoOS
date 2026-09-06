-- Pass the authenticated user explicitly into company membership helper functions
-- so auth.uid() is evaluated once per statement instead of through each helper's
-- default argument for every candidate row. Authorization semantics are unchanged.

drop policy if exists companies_select_members on public.companies;
create policy companies_select_members
  on public.companies
  for select
  to authenticated
  using (public.is_company_member(id, (select auth.uid())));

drop policy if exists companies_update_members on public.companies;
create policy companies_update_members
  on public.companies
  for update
  to authenticated
  using (public.has_company_role(id, array['owner','administrator']::text[], (select auth.uid())))
  with check (public.has_company_role(id, array['owner','administrator']::text[], (select auth.uid())));

drop policy if exists companies_delete_members on public.companies;
create policy companies_delete_members
  on public.companies
  for delete
  to authenticated
  using (public.has_company_role(id, array['owner']::text[], (select auth.uid())));

drop policy if exists company_memberships_delete_admin on public.company_memberships;
create policy company_memberships_delete_admin
  on public.company_memberships
  for delete
  to authenticated
  using (public.has_company_role(company_id, array['owner','administrator']::text[], (select auth.uid())));

drop policy if exists company_memberships_insert_admin on public.company_memberships;
create policy company_memberships_insert_admin
  on public.company_memberships
  for insert
  to authenticated
  with check (
    public.has_company_role(company_id, array['owner','administrator']::text[], (select auth.uid()))
    or (
      user_id = (select auth.uid())
      and lower(role) = 'owner'
      and exists (
        select 1
        from public.companies c
        where c.id = company_memberships.company_id
          and c.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists company_memberships_role_visibility_guard on public.company_memberships;
create policy company_memberships_role_visibility_guard
  on public.company_memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_company_role(
      company_id,
      array['owner','administrator','operations_manager','office_manager']::text[],
      (select auth.uid())
    )
  );

drop policy if exists company_memberships_select_members on public.company_memberships;
create policy company_memberships_select_members
  on public.company_memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_company_member(company_id, (select auth.uid()))
  );

drop policy if exists company_memberships_update_admin on public.company_memberships;
create policy company_memberships_update_admin
  on public.company_memberships
  for update
  to authenticated
  using (public.has_company_role(company_id, array['owner','administrator']::text[], (select auth.uid())))
  with check (public.has_company_role(company_id, array['owner','administrator']::text[], (select auth.uid())));

-- Commercial-launch RLS performance hardening for the central membership table.
-- Preserve all existing role/company/ownership semantics while allowing
-- Postgres to cache stable auth.uid() calls once per statement via initPlans.

alter policy "company_memberships_delete_own"
  on public.company_memberships
  using (user_id = (select auth.uid()));

alter policy "company_memberships_insert_admin"
  on public.company_memberships
  with check (
    has_company_role(company_id, array['owner'::text, 'administrator'::text])
    or (
      user_id = (select auth.uid())
      and lower(role) = 'owner'::text
      and exists (
        select 1
        from public.companies c
        where c.id = company_memberships.company_id
          and c.owner_id = (select auth.uid())
      )
    )
  );

alter policy "company_memberships_insert_own"
  on public.company_memberships
  with check (user_id = (select auth.uid()));

alter policy "company_memberships_role_visibility_guard"
  on public.company_memberships
  using (
    user_id = (select auth.uid())
    or has_company_role(
      company_id,
      array['owner'::text, 'administrator'::text, 'operations_manager'::text, 'office_manager'::text]
    )
  );

alter policy "company_memberships_select_members"
  on public.company_memberships
  using (
    user_id = (select auth.uid())
    or is_company_member(company_id)
  );

alter policy "company_memberships_select_own"
  on public.company_memberships
  using (user_id = (select auth.uid()));

alter policy "company_memberships_update_own"
  on public.company_memberships
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Cache auth.uid() once per statement in Adaptive B.O.S. profile write policies.
-- Authorization semantics remain unchanged: active company membership plus
-- owner/administrator role are still required for writes.

drop policy if exists company_operating_profiles_insert on public.company_operating_profiles;
create policy company_operating_profiles_insert on public.company_operating_profiles
  for insert to authenticated
  with check (
    public.is_company_member(company_id)
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and exists (
      select 1 from public.company_memberships m
      where m.company_id = company_operating_profiles.company_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner','administrator')
    )
  );

drop policy if exists company_operating_profiles_update on public.company_operating_profiles;
create policy company_operating_profiles_update on public.company_operating_profiles
  for update to authenticated
  using (
    public.is_company_member(company_id)
    and exists (
      select 1 from public.company_memberships m
      where m.company_id = company_operating_profiles.company_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner','administrator')
    )
  )
  with check (
    public.is_company_member(company_id)
    and updated_by = (select auth.uid())
    and exists (
      select 1 from public.company_memberships m
      where m.company_id = company_operating_profiles.company_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner','administrator')
    )
  );

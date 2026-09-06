-- Cache auth.uid() once per statement in company ownership/create policies.
-- Authorization semantics remain unchanged.

drop policy if exists "Users can manage their own company" on public.companies;
create policy "Users can manage their own company"
  on public.companies
  for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists companies_insert_members on public.companies;
create policy companies_insert_members
  on public.companies
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (companies.owner_id is null or companies.owner_id = (select auth.uid()))
    and (companies.created_by is null or companies.created_by = (select auth.uid()))
  );

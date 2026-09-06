-- Cache auth.uid() once per statement in Orion background RLS policies.
-- This is authorization-equivalent to the existing policies, but avoids
-- re-evaluating auth.uid() for every candidate row.

drop policy if exists "orion push subscriptions own rows" on public.orion_push_subscriptions;
create policy "orion push subscriptions own rows"
  on public.orion_push_subscriptions
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.company_memberships cm
      where cm.company_id = orion_push_subscriptions.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.company_memberships cm
      where cm.company_id = orion_push_subscriptions.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    )
  );

drop policy if exists "orion reminders own rows" on public.orion_reminders;
create policy "orion reminders own rows"
  on public.orion_reminders
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.company_memberships cm
      where cm.company_id = orion_reminders.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.company_memberships cm
      where cm.company_id = orion_reminders.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    )
  );

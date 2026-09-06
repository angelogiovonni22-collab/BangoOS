-- Commercial-launch RLS performance hardening.
-- Supabase recommends wrapping stable auth helper calls in SELECT so Postgres
-- can evaluate them once per statement (initPlan) rather than once per row.
-- These ALTER POLICY statements preserve the existing membership semantics.

alter policy "bank_accounts_company_access"
  on public.bank_accounts
  using (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_accounts.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  )
  with check (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_accounts.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  );

alter policy "bank_connections_company_access"
  on public.bank_connections
  using (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_connections.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  )
  with check (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_connections.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  );

alter policy "bank_reconciliation_matches_company_access"
  on public.bank_reconciliation_matches
  using (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_reconciliation_matches.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  )
  with check (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_reconciliation_matches.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  );

alter policy "bank_reconciliation_periods_company_access"
  on public.bank_reconciliation_periods
  using (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_reconciliation_periods.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  )
  with check (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_reconciliation_periods.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  );

alter policy "bank_transactions_company_access"
  on public.bank_transactions
  using (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_transactions.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  )
  with check (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = bank_transactions.company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'::text
    )
  );

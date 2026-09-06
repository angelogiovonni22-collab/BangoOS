-- Commercial-launch Data API hardening for private sequence allocator state.
-- These tables are implementation details used by SECURITY DEFINER allocator
-- functions. JWT callers must not read or mutate sequence state directly.

revoke all on table public.company_change_order_sequences from anon, authenticated;
revoke all on table public.company_estimate_sequences from anon, authenticated;
revoke all on table public.company_project_sequences from anon, authenticated;

comment on table public.company_change_order_sequences is
  'Private implementation state for change-order number allocation. Direct Data API access is intentionally revoked.';
comment on table public.company_estimate_sequences is
  'Private implementation state for estimate number allocation. Direct Data API access is intentionally revoked.';
comment on table public.company_project_sequences is
  'Private implementation state for project number allocation. Direct Data API access is intentionally revoked.';

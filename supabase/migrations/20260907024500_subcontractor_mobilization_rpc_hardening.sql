begin;

-- Every current application caller invokes this mutating refresh through the
-- Supabase admin client. Keep it server-only so a signed-in same-company user
-- cannot directly recalculate/write another assignment's mobilization state via
-- the SECURITY DEFINER RPC.
revoke execute on function public.refresh_subcontractor_mobilization_status(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_subcontractor_mobilization_status(uuid, uuid)
  to service_role;

commit;

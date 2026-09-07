begin;

-- This function is a server-side/internal legal-compliance guard composed by
-- higher-level database workflows. It is not an end-user RPC and should not be
-- exposed through PostgREST to anonymous or ordinary authenticated callers.
revoke execute on function public.assert_estimate_work_may_begin(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.assert_estimate_work_may_begin(uuid, uuid)
  to service_role;

commit;

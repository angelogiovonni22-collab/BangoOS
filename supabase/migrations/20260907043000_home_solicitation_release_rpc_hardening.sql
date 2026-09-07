begin;

-- Automatic expiration release is a trusted compliance transition, not a
-- browser action. The repository has no direct client caller for this RPC, so
-- remove signed-in access and keep it available to trusted server workflows.
revoke all on function public.release_expired_home_solicitation_hold(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_expired_home_solicitation_hold(uuid, uuid)
  to service_role;

commit;

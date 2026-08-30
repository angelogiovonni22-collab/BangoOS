-- Commercial-launch security hardening: remove the implicit public execution
-- surface from privileged functions. SECURITY DEFINER functions run with the
-- owner's privileges, so PostgreSQL's default PUBLIC execute grant must not
-- make them anonymous PostgREST RPC endpoints.

do $commercial_launch_rpc_security$
declare
  fn record;
  authenticated_was_allowed boolean;
begin
  for fn in
    select
      p.oid,
      format(
        '%I.%I(%s)',
        n.nspname,
        p.proname,
        pg_get_function_identity_arguments(p.oid)
      ) as function_identity
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    authenticated_was_allowed :=
      pg_catalog.has_function_privilege('authenticated', fn.oid, 'EXECUTE');

    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      fn.function_identity
    );

    -- Preserve the existing signed-in application contract while removing the
    -- anonymous/public inheritance path. A later per-RPC review can narrow the
    -- authenticated surface without coupling that larger change to this fix.
    if authenticated_was_allowed then
      execute format(
        'grant execute on function %s to authenticated',
        fn.function_identity
      );
    end if;

    -- Server-side workflows use the service role for privileged operations.
    execute format(
      'grant execute on function %s to service_role',
      fn.function_identity
    );
  end loop;
end;
$commercial_launch_rpc_security$;

-- Shared blueprint packages are intentionally public, token-scoped, expiring,
-- and revocable. This is the only browser-side anonymous SECURITY DEFINER RPC
-- currently required by the application.
grant execute on function public.validate_blueprint_plan_package(text) to anon;

-- Do not recreate the same exposure when future functions are added.
alter default privileges in schema public
  revoke execute on functions from public, anon;


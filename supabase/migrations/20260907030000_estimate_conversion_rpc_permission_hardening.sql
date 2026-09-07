begin;

-- Keep the existing conversion implementation intact behind an internal name,
-- then expose a guarded wrapper whose authorization matches Orion's semantic
-- contract: converting an approved estimate creates a project, so the caller
-- must be allowed to manage both estimates and projects.
alter function public.convert_estimate_to_project(uuid, uuid, uuid, text, boolean)
  rename to convert_estimate_to_project_internal;

revoke all on function public.convert_estimate_to_project_internal(uuid, uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.convert_estimate_to_project_internal(uuid, uuid, uuid, text, boolean)
  to service_role;

create function public.convert_estimate_to_project(
  p_company_id uuid,
  p_estimate_id uuid,
  p_actor_profile_id uuid,
  p_idempotency_key text,
  p_create_deposit_invoice boolean default true
)
returns table(
  conversion_id uuid,
  project_id uuid,
  project_number text,
  deposit_invoice_id uuid,
  conversion_status text,
  idempotent boolean
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null
       or not public.bos_role_has_permission(p_company_id, 'estimates.manage', auth.uid())
       or not public.bos_role_has_permission(p_company_id, 'projects.manage', auth.uid()) then
      raise exception 'Not authorized to convert estimate to project' using errcode = '42501';
    end if;
  end if;

  return query
  select *
  from public.convert_estimate_to_project_internal(
    p_company_id,
    p_estimate_id,
    p_actor_profile_id,
    p_idempotency_key,
    p_create_deposit_invoice
  );
end;
$function$;

revoke all on function public.convert_estimate_to_project(uuid, uuid, uuid, text, boolean)
  from public, anon;
grant execute on function public.convert_estimate_to_project(uuid, uuid, uuid, text, boolean)
  to authenticated, service_role;

commit;

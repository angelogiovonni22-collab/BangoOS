begin;

-- Preserve the compliant deposit calculation behind an internal name, then
-- expose a guarded wrapper. Deposit amounts are estimate financial data, so a
-- signed-in caller must at least be allowed to view estimates in this company.
alter function public.calculate_estimate_deposit(uuid, uuid)
  rename to calculate_estimate_deposit_internal;

revoke all on function public.calculate_estimate_deposit_internal(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.calculate_estimate_deposit_internal(uuid, uuid)
  to service_role;

create function public.calculate_estimate_deposit(
  p_company_id uuid,
  p_estimate_id uuid
)
returns numeric
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null
     or not public.bos_role_has_permission(p_company_id, 'estimates.view', auth.uid()) then
    raise exception 'Not authorized to calculate estimate deposit' using errcode = '42501';
  end if;

  return public.calculate_estimate_deposit_internal(p_company_id, p_estimate_id);
end;
$function$;

revoke all on function public.calculate_estimate_deposit(uuid, uuid)
  from public, anon;
grant execute on function public.calculate_estimate_deposit(uuid, uuid)
  to authenticated;

commit;

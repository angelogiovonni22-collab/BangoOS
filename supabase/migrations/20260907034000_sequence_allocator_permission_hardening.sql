begin;

-- Number allocators mutate protected sequence rows. Keep the allocation logic
-- intact behind internal names and make each public RPC enforce the same
-- semantic permission required to create the corresponding business record.
alter function public.allocate_estimate_number(uuid)
  rename to allocate_estimate_number_internal;
alter function public.allocate_project_number(uuid)
  rename to allocate_project_number_internal;
alter function public.allocate_change_order_number(uuid)
  rename to allocate_change_order_number_internal;

revoke all on function public.allocate_estimate_number_internal(uuid)
  from public, anon, authenticated;
revoke all on function public.allocate_project_number_internal(uuid)
  from public, anon, authenticated;
revoke all on function public.allocate_change_order_number_internal(uuid)
  from public, anon, authenticated;

create function public.allocate_estimate_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null
     or not public.bos_role_has_permission(p_company_id, 'estimates.manage', auth.uid()) then
    raise exception 'Not authorized to allocate estimate number' using errcode = '42501';
  end if;
  return public.allocate_estimate_number_internal(p_company_id);
end;
$function$;

create function public.allocate_project_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null
     or not public.bos_role_has_permission(p_company_id, 'projects.manage', auth.uid()) then
    raise exception 'Not authorized to allocate project number' using errcode = '42501';
  end if;
  return public.allocate_project_number_internal(p_company_id);
end;
$function$;

create function public.allocate_change_order_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null
     or not public.bos_role_has_permission(p_company_id, 'change_orders.manage', auth.uid()) then
    raise exception 'Not authorized to allocate change order number' using errcode = '42501';
  end if;
  return public.allocate_change_order_number_internal(p_company_id);
end;
$function$;

revoke all on function public.allocate_estimate_number(uuid) from public, anon;
revoke all on function public.allocate_project_number(uuid) from public, anon;
revoke all on function public.allocate_change_order_number(uuid) from public, anon;
grant execute on function public.allocate_estimate_number(uuid) to authenticated;
grant execute on function public.allocate_project_number(uuid) to authenticated;
grant execute on function public.allocate_change_order_number(uuid) to authenticated;

commit;

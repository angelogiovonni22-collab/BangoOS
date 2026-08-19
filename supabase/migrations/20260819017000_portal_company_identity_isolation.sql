begin;

-- The companies row contains internal business metadata (license, insurance,
-- owner/contact and configuration fields). Portal accounts only need the company
-- identity used to brand their scoped workspace. Expose that identity through a
-- narrow SECURITY DEFINER RPC and deny direct companies-row reads to external
-- customer/subcontractor memberships.
create or replace function public.get_my_portal_company_identity(p_company_id uuid)
returns table(company_id uuid, company_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.name
  from public.companies c
  where c.id = p_company_id
    and exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = c.id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and lower(cm.role) in ('subcontractor','customer')
    )
  limit 1;
$$;

revoke execute on function public.get_my_portal_company_identity(uuid) from public, anon;
grant execute on function public.get_my_portal_company_identity(uuid) to authenticated;

drop policy if exists bos_external_company_metadata_select_guard on public.companies;
create policy bos_external_company_metadata_select_guard
on public.companies
as restrictive
for select
to authenticated
using (
  not public.bos_is_external_company_user(id)
);

commit;

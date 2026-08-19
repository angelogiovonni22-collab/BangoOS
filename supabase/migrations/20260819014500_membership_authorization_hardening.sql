begin;

-- ---------------------------------------------------------------------------
-- Active-membership authorization hardening
--
-- company_memberships is the authorization source of truth. Legacy profile rows
-- remain useful for display/onboarding, but cannot grant company access by
-- themselves. This closes self-reactivation and self-role-escalation paths.
-- ---------------------------------------------------------------------------

create or replace function public.bos_has_active_company_access(
  p_company_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_company_id is not null and p_user_id is not null and (
    exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = p_company_id
        and cm.user_id = p_user_id
        and cm.status = 'active'
    )
    or exists (
      select 1
      from public.companies c
      where c.id = p_company_id
        and c.owner_id = p_user_id
    )
  );
$$;

revoke execute on function public.bos_has_active_company_access(uuid,uuid) from public, anon;
grant execute on function public.bos_has_active_company_access(uuid,uuid) to authenticated, service_role;

-- A user must never be able to create, promote, reactivate, or delete their own
-- company authorization row. The existing admin policy remains in place and
-- already contains the narrow first-owner bootstrap exception tied to
-- companies.owner_id = auth.uid().
drop policy if exists company_memberships_insert_own on public.company_memberships;
drop policy if exists company_memberships_update_own on public.company_memberships;
drop policy if exists company_memberships_delete_own on public.company_memberships;

-- Every company-scoped RLS table gets a restrictive active-membership gate.
-- Existing feature/role/assignment policies continue to decide what an active
-- member may do; this guard only establishes the minimum tenant boundary.
-- profiles and company_memberships are identity-source tables and are handled by
-- their dedicated self/admin policies instead.
do $$
declare
  t record;
begin
  for t in
    select c.relname as table_name,
           a.attnotnull as company_id_not_null
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a
      on a.attrelid = c.oid
     and a.attname = 'company_id'
     and not a.attisdropped
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and c.relname not in ('profiles', 'company_memberships')
  loop
    execute format('drop policy if exists bos_active_membership_guard on public.%I', t.table_name);

    if t.company_id_not_null then
      execute format(
        'create policy bos_active_membership_guard on public.%I as restrictive for all to authenticated using (public.bos_has_active_company_access(company_id)) with check (public.bos_has_active_company_access(company_id))',
        t.table_name
      );
    else
      -- Global/system rows with a null company_id remain readable/writable only
      -- when another existing policy allows them; tenant rows require access.
      execute format(
        'create policy bos_active_membership_guard on public.%I as restrictive for all to authenticated using (company_id is null or public.bos_has_active_company_access(company_id)) with check (company_id is null or public.bos_has_active_company_access(company_id))',
        t.table_name
      );
    end if;
  end loop;
end $$;

-- Storage paths in all B.O.S. private buckets are rooted by company UUID. Make
-- that tenant prefix an explicit restrictive boundary rather than trusting a
-- mutable legacy profile.company_id. Existing bucket/project/assignment policies
-- remain in force and provide the finer-grained authorization.
create or replace function public.bos_storage_path_company_id(p_name text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_first text;
begin
  v_first := split_part(coalesce(p_name, ''), '/', 1);
  if v_first ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v_first::uuid;
  end if;
  return null;
exception when invalid_text_representation then
  return null;
end;
$$;

grant execute on function public.bos_storage_path_company_id(text) to authenticated, service_role;

drop policy if exists bos_active_membership_storage_select_guard on storage.objects;
create policy bos_active_membership_storage_select_guard
on storage.objects
as restrictive
for select
to authenticated
using (
  public.bos_storage_path_company_id(name) is not null
  and public.bos_has_active_company_access(public.bos_storage_path_company_id(name))
);

drop policy if exists bos_active_membership_storage_insert_guard on storage.objects;
create policy bos_active_membership_storage_insert_guard
on storage.objects
as restrictive
for insert
to authenticated
with check (
  public.bos_storage_path_company_id(name) is not null
  and public.bos_has_active_company_access(public.bos_storage_path_company_id(name))
);

drop policy if exists bos_active_membership_storage_update_guard on storage.objects;
create policy bos_active_membership_storage_update_guard
on storage.objects
as restrictive
for update
to authenticated
using (
  public.bos_storage_path_company_id(name) is not null
  and public.bos_has_active_company_access(public.bos_storage_path_company_id(name))
)
with check (
  public.bos_storage_path_company_id(name) is not null
  and public.bos_has_active_company_access(public.bos_storage_path_company_id(name))
);

drop policy if exists bos_active_membership_storage_delete_guard on storage.objects;
create policy bos_active_membership_storage_delete_guard
on storage.objects
as restrictive
for delete
to authenticated
using (
  public.bos_storage_path_company_id(name) is not null
  and public.bos_has_active_company_access(public.bos_storage_path_company_id(name))
);

commit;

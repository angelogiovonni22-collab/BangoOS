begin;

-- External accounts are portal-only at the database boundary as well as the route layer.
-- Existing dedicated partner policies remain the only direct-table exceptions for
-- assignment-scoped photos, approved plans, and partner messages.
create or replace function public.bos_is_external_company_user(
  p_company_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_company_id is not null and exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.status = 'active'
      and lower(cm.role) in ('subcontractor','customer')
  );
$$;

create or replace function public.bos_is_customer_for_company(
  p_company_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_company_id is not null and exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.status = 'active'
      and lower(cm.role) = 'customer'
  );
$$;

create or replace function public.bos_is_portal_only_user(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = p_user_id
        and cm.status = 'active'
        and lower(cm.role) in ('subcontractor','customer')
    )
    and not exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = p_user_id
        and cm.status = 'active'
        and lower(cm.role) not in ('subcontractor','customer')
    );
$$;

grant execute on function public.bos_is_external_company_user(uuid,uuid) to authenticated;
grant execute on function public.bos_is_customer_for_company(uuid,uuid) to authenticated;
grant execute on function public.bos_is_portal_only_user(uuid) to authenticated;

-- Deny external roles at every existing company-scoped RLS table by default.
-- Workspace identity tables and the three explicitly scoped partner channels are
-- excluded because they already have purpose-built restrictive policies.
do $$
declare
  t record;
begin
  for t in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and exists (
        select 1
        from pg_attribute a
        where a.attrelid = c.oid
          and a.attname = 'company_id'
          and not a.attisdropped
      )
      and c.relname not in (
        'profiles',
        'company_memberships',
        'project_photos',
        'blueprint_sets',
        'blueprint_sheets',
        'blueprint_versions',
        'trade_partner_messages'
      )
  loop
    execute format('drop policy if exists bos_external_portal_isolation_guard on public.%I', t.table_name);
    execute format(
      'create policy bos_external_portal_isolation_guard on public.%I as restrictive for all to authenticated using (not public.bos_is_external_company_user(company_id)) with check (not public.bos_is_external_company_user(company_id))',
      t.table_name
    );
  end loop;
end $$;

-- Customer portal currently exposes project summary only through a sanitized
-- SECURITY DEFINER RPC. It must not inherit partner photo/plan/message channels.
do $$
declare
  t text;
begin
  foreach t in array array[
    'project_photos',
    'blueprint_sets',
    'blueprint_sheets',
    'blueprint_versions',
    'trade_partner_messages'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists bos_customer_portal_channel_guard on public.%I', t);
      execute format(
        'create policy bos_customer_portal_channel_guard on public.%I as restrictive for all to authenticated using (not public.bos_is_customer_for_company(company_id)) with check (not public.bos_is_customer_for_company(company_id))',
        t
      );
    end if;
  end loop;
end $$;

-- Storage must follow the same portal boundary. A portal-only subcontractor may
-- read assignment-scoped approved blueprints and assignment-scoped job photos,
-- and may mutate only their scoped project-photo objects. Existing restrictive
-- partner storage policies perform the project/ownership checks. Customers have
-- no direct storage channel until the customer portal intentionally implements one.
drop policy if exists bos_external_portal_storage_select_guard on storage.objects;
create policy bos_external_portal_storage_select_guard
on storage.objects
as restrictive
for select
to authenticated
using (
  not public.bos_is_portal_only_user()
  or (
    bucket_id in ('project-photos','blueprints')
    and exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
        and lower(cm.role) = 'subcontractor'
    )
  )
);

drop policy if exists bos_external_portal_storage_insert_guard on storage.objects;
create policy bos_external_portal_storage_insert_guard
on storage.objects
as restrictive
for insert
to authenticated
with check (
  not public.bos_is_portal_only_user()
  or (
    bucket_id = 'project-photos'
    and exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
        and lower(cm.role) = 'subcontractor'
    )
  )
);

drop policy if exists bos_external_portal_storage_update_guard on storage.objects;
create policy bos_external_portal_storage_update_guard
on storage.objects
as restrictive
for update
to authenticated
using (
  not public.bos_is_portal_only_user()
  or (
    bucket_id = 'project-photos'
    and exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
        and lower(cm.role) = 'subcontractor'
    )
  )
)
with check (
  not public.bos_is_portal_only_user()
  or (
    bucket_id = 'project-photos'
    and exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
        and lower(cm.role) = 'subcontractor'
    )
  )
);

drop policy if exists bos_external_portal_storage_delete_guard on storage.objects;
create policy bos_external_portal_storage_delete_guard
on storage.objects
as restrictive
for delete
to authenticated
using (
  not public.bos_is_portal_only_user()
  or (
    bucket_id = 'project-photos'
    and exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
        and lower(cm.role) = 'subcontractor'
    )
  )
);

commit;

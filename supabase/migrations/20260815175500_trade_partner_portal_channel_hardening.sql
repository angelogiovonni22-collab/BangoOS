begin;

-- Trade partners can never mutate Blueprint records; approved plans are read-only.
do $$
declare
  t text;
begin
  foreach t in array array['blueprint_sets','blueprint_sheets','blueprint_versions'] loop
    execute format('drop policy if exists %I on public.%I', 'bos_trade_partner_' || t || '_update_guard', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (not public.bos_is_trade_partner_for_company(company_id)) with check (not public.bos_is_trade_partner_for_company(company_id))',
      'bos_trade_partner_' || t || '_update_guard', t
    );
    execute format('drop policy if exists %I on public.%I', 'bos_trade_partner_' || t || '_delete_guard', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (not public.bos_is_trade_partner_for_company(company_id))',
      'bos_trade_partner_' || t || '_delete_guard', t
    );
  end loop;
end $$;

-- A trade partner may not update/delete plan storage objects at all.
drop policy if exists bos_trade_partner_blueprint_storage_update_guard on storage.objects;
create policy bos_trade_partner_blueprint_storage_update_guard
on storage.objects
as restrictive
for update
to authenticated
using (
  bucket_id <> 'blueprints'
  or not exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
)
with check (
  bucket_id <> 'blueprints'
  or not exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
);

drop policy if exists bos_trade_partner_blueprint_storage_delete_guard on storage.objects;
create policy bos_trade_partner_blueprint_storage_delete_guard
on storage.objects
as restrictive
for delete
to authenticated
using (
  bucket_id <> 'blueprints'
  or not exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
);

-- Photo object mutation is limited to a partner's own registered photo on an assigned project.
drop policy if exists bos_trade_partner_project_photo_storage_update_guard on storage.objects;
create policy bos_trade_partner_project_photo_storage_update_guard
on storage.objects
as restrictive
for update
to authenticated
using (
  bucket_id <> 'project-photos'
  or not exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
  or exists (
    select 1 from public.project_photos pp
    where pp.storage_path = storage.objects.name
      and pp.uploaded_by = auth.uid()
      and public.bos_can_access_trade_partner_project(pp.project_id)
  )
)
with check (
  bucket_id <> 'project-photos'
  or not exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
  or exists (
    select 1 from public.project_photos pp
    where pp.storage_path = storage.objects.name
      and pp.uploaded_by = auth.uid()
      and public.bos_can_access_trade_partner_project(pp.project_id)
  )
);

drop policy if exists bos_trade_partner_project_photo_storage_delete_guard on storage.objects;
create policy bos_trade_partner_project_photo_storage_delete_guard
on storage.objects
as restrictive
for delete
to authenticated
using (
  bucket_id <> 'project-photos'
  or not exists (
    select 1 from public.company_memberships cm
    where cm.user_id = auth.uid() and cm.status = 'active' and lower(cm.role) = 'subcontractor'
  )
  or exists (
    select 1 from public.project_photos pp
    where pp.storage_path = storage.objects.name
      and pp.uploaded_by = auth.uid()
      and public.bos_can_access_trade_partner_project(pp.project_id)
  )
);

commit;

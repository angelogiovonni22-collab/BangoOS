-- Keep subcontractor project-photo access tied to an active linked vendor assignment.
-- An older permissive photo policy depends on profiles.company_id; newly invited
-- trade partners can instead be represented by company_memberships.vendor_id.
-- These additional PERMISSIVE policies still compose with the existing RESTRICTIVE
-- vendor/project/category guards, and do not alter internal employee policies.

drop policy if exists partner_assigned_photo_storage_insert on storage.objects;
create policy partner_assigned_photo_storage_insert
on storage.objects as permissive for insert to authenticated
with check (
  bucket_id = 'project-photos'
  and split_part(name, '/', 3) <> ''
  and exists (
    select 1 from public.company_memberships cm
    where cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and lower(cm.role) = 'subcontractor'
      and cm.vendor_id is not null
      and cm.company_id::text = split_part(name, '/', 1)
      and public.bos_can_access_trade_partner_project(
        case when split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then split_part(name, '/', 2)::uuid else null end
      )
  )
);

drop policy if exists partner_assigned_photo_storage_select on storage.objects;
create policy partner_assigned_photo_storage_select
on storage.objects as permissive for select to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_photos pp
    join public.company_memberships cm on cm.company_id = pp.company_id
    where pp.storage_path = name
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and lower(cm.role) = 'subcontractor'
      and cm.vendor_id is not null
      and public.bos_can_access_trade_partner_project(pp.project_id)
  )
);

drop policy if exists partner_assigned_project_photo_insert on public.project_photos;
create policy partner_assigned_project_photo_insert
on public.project_photos as permissive for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and category in ('progress','safety','damage','materials','inspection','other')
  and exists (
    select 1 from public.company_memberships cm
    where cm.user_id = (select auth.uid())
      and cm.company_id = project_photos.company_id
      and cm.status = 'active'
      and lower(cm.role) = 'subcontractor'
      and cm.vendor_id is not null
      and public.bos_can_access_trade_partner_project(project_photos.project_id)
  )
);

drop policy if exists partner_assigned_project_photo_select on public.project_photos;
create policy partner_assigned_project_photo_select
on public.project_photos as permissive for select to authenticated
using (
  category in ('before','progress','after','safety','damage','materials','inspection','other')
  and exists (
    select 1 from public.company_memberships cm
    where cm.user_id = (select auth.uid())
      and cm.company_id = project_photos.company_id
      and cm.status = 'active'
      and lower(cm.role) = 'subcontractor'
      and cm.vendor_id is not null
      and public.bos_can_access_trade_partner_project(project_photos.project_id)
  )
);

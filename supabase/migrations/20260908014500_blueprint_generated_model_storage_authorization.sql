begin;

create or replace function public.blueprint_storage_path_authorized(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.blueprint_sheets sheet
      where sheet.company_id::text = split_part(object_name, '/', 1)
        and sheet.project_id::text = split_part(object_name, '/', 2)
        and sheet.id::text = split_part(object_name, '/', 3)
        and split_part(object_name, '/', 4) <> ''
        and public.is_company_member(sheet.company_id)
    )
    or exists (
      select 1
      from public.blueprint_versions version
      where split_part(object_name, '/', 3) = 'generated-3d'
        and version.company_id::text = split_part(object_name, '/', 1)
        and version.project_id::text = split_part(object_name, '/', 2)
        and version.id::text = split_part(object_name, '/', 4)
        and split_part(object_name, '/', 5) <> ''
        and public.is_company_member(version.company_id)
    );
$$;

revoke all on function public.blueprint_storage_path_authorized(text) from public, anon;
grant execute on function public.blueprint_storage_path_authorized(text) to authenticated;

comment on function public.blueprint_storage_path_authorized(text) is
'Authorizes private Blueprint source-sheet objects and B.O.S.-generated 3D model objects by tenant, project, and source revision path.';

commit;

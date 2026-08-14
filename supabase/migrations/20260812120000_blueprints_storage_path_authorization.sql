begin;

create or replace function public.blueprint_storage_path_authorized(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.blueprint_sheets sheet
    where sheet.company_id::text = split_part(object_name, '/', 1)
      and sheet.project_id::text = split_part(object_name, '/', 2)
      and sheet.id::text = split_part(object_name, '/', 3)
      and split_part(object_name, '/', 4) <> ''
      and public.is_company_member(sheet.company_id)
  );
$$;

revoke all on function public.blueprint_storage_path_authorized(text) from public, anon;
grant execute on function public.blueprint_storage_path_authorized(text) to authenticated;

drop policy if exists blueprints_storage_insert on storage.objects;
drop policy if exists blueprints_storage_delete on storage.objects;

create policy blueprints_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'blueprints'
  and public.blueprint_storage_path_authorized(name)
);

create policy blueprints_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'blueprints'
  and public.blueprint_storage_path_authorized(name)
);

commit;

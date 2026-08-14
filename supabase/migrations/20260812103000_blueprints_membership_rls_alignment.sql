begin;

create or replace function public.blueprint_member_of_company(tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_member(tenant_id);
$$;

drop policy if exists blueprints_storage_insert on storage.objects;
drop policy if exists blueprints_storage_delete on storage.objects;

create policy blueprints_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'blueprints'
  and exists (
    select 1
    from public.projects project
    where project.company_id::text = (storage.foldername(name))[1]
      and project.id::text = (storage.foldername(name))[2]
      and public.is_company_member(project.company_id)
  )
);

create policy blueprints_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'blueprints'
  and exists (
    select 1
    from public.projects project
    where project.company_id::text = (storage.foldername(name))[1]
      and project.id::text = (storage.foldername(name))[2]
      and public.is_company_member(project.company_id)
  )
);

commit;

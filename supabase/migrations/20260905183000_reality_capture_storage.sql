begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bos-reality-captures',
  'bos-reality-captures',
  false,
  262144000,
  array['model/vnd.usdz+zip','model/usd','application/octet-stream','application/json']
)
on conflict (id) do update
set public = false,
    file_size_limit = 262144000,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bos_reality_captures_storage_select on storage.objects;
create policy bos_reality_captures_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'bos-reality-captures'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
  and exists (
    select 1
    from public.reality_capture_sessions s
    where s.id = ((storage.foldername(name))[3])::uuid
      and s.company_id = ((storage.foldername(name))[1])::uuid
      and s.project_id = ((storage.foldername(name))[2])::uuid
  )
);

drop policy if exists bos_reality_captures_storage_insert on storage.objects;
create policy bos_reality_captures_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'bos-reality-captures'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
  and exists (
    select 1
    from public.reality_capture_sessions s
    where s.id = ((storage.foldername(name))[3])::uuid
      and s.company_id = ((storage.foldername(name))[1])::uuid
      and s.project_id = ((storage.foldername(name))[2])::uuid
      and s.created_by = auth.uid()
  )
);

drop policy if exists bos_reality_captures_storage_delete on storage.objects;
create policy bos_reality_captures_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'bos-reality-captures'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
  and exists (
    select 1
    from public.reality_capture_sessions s
    where s.id = ((storage.foldername(name))[3])::uuid
      and s.company_id = ((storage.foldername(name))[1])::uuid
      and s.project_id = ((storage.foldername(name))[2])::uuid
      and s.created_by = auth.uid()
  )
);

commit;

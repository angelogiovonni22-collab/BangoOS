begin;

-- An attachment inherits the current caller's access to its parent record.
-- Invoker rights retain parent RLS, project assignment scope and role overrides.
create function public.record_attachment_parent_access(kind text, record_id uuid, tenant_id uuid, for_write boolean default false)
returns boolean language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null
    and (not for_write or public.bos_role_has_permission(tenant_id, case kind
      when 'customer' then 'customers.manage'
      when 'estimate' then 'estimates.manage'
      when 'invoice' then 'invoices.manage'
      when 'project' then 'projects.manage'
      else '' end))
    and case kind
      when 'customer' then exists(select 1 from public.customers where id = record_id and company_id = tenant_id)
      when 'estimate' then exists(select 1 from public.estimates where id = record_id and company_id = tenant_id)
      when 'invoice' then exists(select 1 from public.invoices where id = record_id and company_id = tenant_id)
      when 'project' then exists(select 1 from public.projects where id = record_id and company_id = tenant_id)
      else false end;
$$;

create function public.record_attachment_path_access(object_name text, for_write boolean default false)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare parts text[] = string_to_array(object_name, '/');
begin
  if array_length(parts, 1) <> 4 or coalesce(parts[4], '') = '' then return false; end if;
  return coalesce(public.record_attachment_parent_access(parts[2], parts[3]::uuid, parts[1]::uuid, for_write), false);
exception when invalid_text_representation then return false;
end;
$$;

revoke all on function public.record_attachment_parent_access(text, uuid, uuid, boolean) from public, anon;
revoke all on function public.record_attachment_path_access(text, boolean) from public, anon;
grant execute on function public.record_attachment_parent_access(text, uuid, uuid, boolean) to authenticated;
grant execute on function public.record_attachment_path_access(text, boolean) to authenticated;

create policy record_attachments_parent_read_guard on public.record_attachments as restrictive
for all to authenticated
using (public.record_attachment_parent_access(entity_type, entity_id, company_id))
with check (public.record_attachment_parent_access(entity_type, entity_id, company_id));

create policy record_attachments_parent_insert_guard on public.record_attachments as restrictive
for insert to authenticated with check (
  public.record_attachment_parent_access(entity_type, entity_id, company_id, true)
  and split_part(storage_path, '/', 1) = company_id::text
  and split_part(storage_path, '/', 2) = entity_type
  and split_part(storage_path, '/', 3) = entity_id::text
  and public.record_attachment_path_access(storage_path, true)
);
create policy record_attachments_parent_update_guard on public.record_attachments as restrictive
for update to authenticated
using (public.record_attachment_parent_access(entity_type, entity_id, company_id, true))
with check (
  public.record_attachment_parent_access(entity_type, entity_id, company_id, true)
  and split_part(storage_path, '/', 1) = company_id::text
  and split_part(storage_path, '/', 2) = entity_type
  and split_part(storage_path, '/', 3) = entity_id::text
  and public.record_attachment_path_access(storage_path, true)
);
create policy record_attachments_parent_delete_guard on public.record_attachments as restrictive
for delete to authenticated using (public.record_attachment_parent_access(entity_type, entity_id, company_id, true));

-- These guards narrow existing company policies; unrelated buckets retain their policies.
create policy record_attachments_storage_parent_select_guard on storage.objects as restrictive
for select to authenticated using (bucket_id <> 'record-attachments' or public.record_attachment_path_access(name));
create policy record_attachments_storage_parent_insert_guard on storage.objects as restrictive
for insert to authenticated with check (bucket_id <> 'record-attachments' or public.record_attachment_path_access(name, true));
create policy record_attachments_storage_parent_delete_guard on storage.objects as restrictive
for delete to authenticated using (bucket_id <> 'record-attachments' or public.record_attachment_path_access(name, true));
create policy record_attachments_storage_parent_update_guard on storage.objects as restrictive
for update to authenticated
using (bucket_id <> 'record-attachments' or public.record_attachment_path_access(name, true))
with check (bucket_id <> 'record-attachments' or public.record_attachment_path_access(name, true));

-- Upload precedes metadata. Writers must see their permitted path for upload
-- RETURNING and cleanup if the metadata insert fails. No UPDATE policy is added:
-- this upload workflow explicitly uses upsert:false.
create policy record_attachments_storage_writer_select on storage.objects
for select to authenticated using (
  bucket_id = 'record-attachments'
  and public.record_attachment_path_access(name, true)
  and exists(select 1 from public.profiles where id = auth.uid() and company_id::text = split_part(name, '/', 1))
);

commit;

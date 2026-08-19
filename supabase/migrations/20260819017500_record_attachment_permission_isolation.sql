begin;

create or replace function public.bos_can_access_record_attachment_entity(
  p_company_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_write boolean default false,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_permission text;
  v_exists boolean := false;
begin
  if p_company_id is null or p_entity_id is null or p_user_id is null then return false; end if;
  if public.bos_is_external_company_user(p_company_id, p_user_id) then return false; end if;

  v_permission := case p_entity_type
    when 'customer' then case when p_write then 'customers.manage' else 'customers.view' end
    when 'estimate' then case when p_write then 'estimates.manage' else 'estimates.view' end
    when 'invoice' then case when p_write then 'invoices.manage' else 'invoices.view' end
    when 'project' then case when p_write then 'projects.manage' else 'projects.view' end
    else null
  end;
  if v_permission is null or not public.bos_role_has_permission(p_company_id, v_permission, p_user_id) then return false; end if;

  v_exists := case p_entity_type
    when 'customer' then exists(select 1 from public.customers where id=p_entity_id and company_id=p_company_id)
    when 'estimate' then exists(select 1 from public.estimates where id=p_entity_id and company_id=p_company_id)
    when 'invoice' then exists(select 1 from public.invoices where id=p_entity_id and company_id=p_company_id)
    when 'project' then exists(select 1 from public.projects where id=p_entity_id and company_id=p_company_id)
    else false
  end;
  return v_exists;
end;
$$;

revoke execute on function public.bos_can_access_record_attachment_entity(uuid,text,uuid,boolean,uuid) from public, anon;
grant execute on function public.bos_can_access_record_attachment_entity(uuid,text,uuid,boolean,uuid) to authenticated, service_role;

drop policy if exists bos_record_attachments_select_guard on public.record_attachments;
create policy bos_record_attachments_select_guard on public.record_attachments as restrictive
for select to authenticated using (
  public.bos_can_access_record_attachment_entity(company_id,entity_type,entity_id,false)
);

drop policy if exists bos_record_attachments_insert_guard on public.record_attachments;
create policy bos_record_attachments_insert_guard on public.record_attachments as restrictive
for insert to authenticated with check (
  uploaded_by=auth.uid()
  and public.bos_can_access_record_attachment_entity(company_id,entity_type,entity_id,true)
);

drop policy if exists bos_record_attachments_update_guard on public.record_attachments;
create policy bos_record_attachments_update_guard on public.record_attachments as restrictive
for update to authenticated using (
  public.bos_can_access_record_attachment_entity(company_id,entity_type,entity_id,true)
) with check (
  public.bos_can_access_record_attachment_entity(company_id,entity_type,entity_id,true)
);

drop policy if exists bos_record_attachments_delete_guard on public.record_attachments;
create policy bos_record_attachments_delete_guard on public.record_attachments as restrictive
for delete to authenticated using (
  public.bos_can_access_record_attachment_entity(company_id,entity_type,entity_id,true)
);

-- Storage paths are company/entity-type/entity-id/object. Enforce the same
-- entity permission before bytes can be uploaded/read/deleted, rather than relying
-- on a same-company profile match.
drop policy if exists bos_record_attachment_storage_insert_guard on storage.objects;
create policy bos_record_attachment_storage_insert_guard on storage.objects as restrictive
for insert to authenticated with check (
  bucket_id <> 'record-attachments'
  or (
    public.bos_storage_path_company_id(name) is not null
    and split_part(name,'/',2) in ('customer','estimate','invoice','project')
    and split_part(name,'/',3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and public.bos_can_access_record_attachment_entity(
      public.bos_storage_path_company_id(name), split_part(name,'/',2), split_part(name,'/',3)::uuid, true
    )
  )
);

drop policy if exists bos_record_attachment_storage_select_guard on storage.objects;
create policy bos_record_attachment_storage_select_guard on storage.objects as restrictive
for select to authenticated using (
  bucket_id <> 'record-attachments'
  or exists (
    select 1 from public.record_attachments a
    where a.storage_path=objects.name
      and public.bos_can_access_record_attachment_entity(a.company_id,a.entity_type,a.entity_id,false)
  )
);

drop policy if exists bos_record_attachment_storage_delete_guard on storage.objects;
create policy bos_record_attachment_storage_delete_guard on storage.objects as restrictive
for delete to authenticated using (
  bucket_id <> 'record-attachments'
  or exists (
    select 1 from public.record_attachments a
    where a.storage_path=objects.name
      and public.bos_can_access_record_attachment_entity(a.company_id,a.entity_type,a.entity_id,true)
  )
);

commit;

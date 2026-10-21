-- Run after the migration in a single BEGIN/ROLLBACK transaction.
-- Metadata probes only: no Storage objects, files, sessions or memberships created.
create temp table attachment_access_context as
select i.company_id, i.id invoice_id, i.customer_id, i.project_id,
  (select e.id from public.estimates e where e.company_id=i.company_id limit 1) estimate_id,
  c.owner_id, gen_random_uuid() attachment_id,
  (select other.id from public.companies other where other.id<>i.company_id
    and other.owner_id is distinct from c.owner_id
    and not exists(select 1 from public.company_memberships m where m.company_id=other.id and m.user_id=c.owner_id and m.status='active') limit 1) foreign_company_id
from public.invoices i join public.projects p on p.id=i.project_id
join public.companies c on c.id=i.company_id
where p.name='BOS Pilot 20261019 — synthetic project' and i.status='void' limit 1;
grant select on attachment_access_context to authenticated;

select set_config('bos.audit.attachment_actors', (
  select jsonb_agg(jsonb_build_object('uid',m.user_id,'role',m.role))::text
  from public.company_memberships m join attachment_access_context c on c.company_id=m.company_id
  join public.profiles p on p.id=m.user_id and p.company_id=m.company_id
  where m.status='active'), true);

insert into public.record_attachments(id,company_id,entity_type,entity_id,storage_path,uploaded_by,mime_type,file_size_bytes,original_filename)
select attachment_id,company_id,'invoice',invoice_id,
  company_id::text||'/invoice/'||invoice_id::text||'/BOS-ACCESS-ROLLBACK-ONLY.png',
  owner_id,'image/png',1,'BOS-ACCESS-ROLLBACK-ONLY.png' from attachment_access_context;

set local role authenticated;
do $test$
declare c record; a jsonb; view_ok boolean; manage_ok boolean; accepted boolean;
  n bigint; path text; rows_result jsonb='[]'; entity record;
begin
  select * into strict c from attachment_access_context;
  if c.foreign_company_id is null or c.estimate_id is null then raise exception 'Missing positive/foreign controls'; end if;
  path:=c.company_id::text||'/invoice/'||c.invoice_id::text||'/BOS-ACCESS-ROLLBACK-ONLY.png';
  for a in select value from jsonb_array_elements(current_setting('bos.audit.attachment_actors')::jsonb) loop
    perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',a->>'uid')::text,true);
    view_ok:=public.bos_role_has_permission(c.company_id,'invoices.view');
    manage_ok:=public.bos_role_has_permission(c.company_id,'invoices.manage');
    select count(*) into n from public.record_attachments where id=c.attachment_id;
    if n<>(case when view_ok then 1 else 0 end) then raise exception 'Attachment read differs from parent for %',a->>'role'; end if;
    if public.record_attachment_path_access(path) is distinct from view_ok
      or public.record_attachment_path_access(path,true) is distinct from (view_ok and manage_ok) then
      raise exception 'File path permission differs from parent for %',a->>'role';
    end if;
    accepted:=false;
    begin
      insert into public.record_attachments(company_id,entity_type,entity_id,storage_path,uploaded_by,mime_type,file_size_bytes,original_filename)
      values(c.company_id,'invoice',c.invoice_id,replace(path,'ONLY.png',gen_random_uuid()::text||'.png'),(a->>'uid')::uuid,'image/png',1,'BOS-ACCESS-ROLLBACK-ONLY.png');
      raise sqlstate 'PZ001'; -- Roll back a successful positive control too.
    exception when sqlstate 'PZ001' then accepted:=true; when insufficient_privilege then accepted:=false; end;
    if accepted is distinct from (view_ok and manage_ok) then raise exception 'Wrong insert entitlement for %',a->>'role'; end if;
    begin
      update public.record_attachments set caption='BOS-ACCESS-ROLLBACK-ONLY' where id=c.attachment_id;
      get diagnostics n=row_count;
      raise sqlstate 'PZ001';
    exception when sqlstate 'PZ001' then null; end;
    if n<>(case when view_ok and manage_ok then 1 else 0 end) then raise exception 'Wrong update entitlement for %',a->>'role'; end if;
    begin
      delete from public.record_attachments where id=c.attachment_id;
      get diagnostics n=row_count;
      raise sqlstate 'PZ001';
    exception when sqlstate 'PZ001' then null; end;
    if n<>(case when view_ok and manage_ok then 1 else 0 end) then raise exception 'Wrong delete entitlement for %',a->>'role'; end if;
    if public.record_attachment_path_access(c.foreign_company_id::text||'/invoice/'||c.invoice_id::text||'/probe.png')
      or public.record_attachment_path_access(c.foreign_company_id::text||'/invoice/'||c.invoice_id::text||'/probe.png',true)
      or public.record_attachment_path_access(c.company_id::text||'/invoice/not-a-uuid/probe.png')
      or public.record_attachment_path_access(c.company_id::text||'/invoice/'||c.invoice_id::text||'/') then
      raise exception 'Foreign/malformed file path accepted';
    end if;
    rows_result:=rows_result||jsonb_build_object('role',a->>'role','read',view_ok,'write',manage_ok,'metadata_crud','PASS','path_checks','PASS');
  end loop;

  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',c.owner_id)::text,true);
  for entity in select * from (values ('invoice',c.invoice_id),('customer',c.customer_id),('estimate',c.estimate_id),('project',c.project_id)) as e(kind,id) loop
    if not public.record_attachment_parent_access(entity.kind,entity.id,c.company_id,true) then raise exception 'Owner positive control failed: %',entity.kind; end if;
    if public.record_attachment_parent_access(entity.kind,entity.id,c.foreign_company_id,true) then raise exception 'Foreign parent accepted'; end if;
  end loop;
  accepted:=false;
  begin
    update public.record_attachments set storage_path=c.company_id::text||'/project/'||c.project_id::text||'/BOS-WRONG-PARENT.png' where id=c.attachment_id;
    raise sqlstate 'PZ001';
  exception when sqlstate 'PZ001' then accepted:=true; when insufficient_privilege then null; end;
  if accepted then raise exception 'Metadata path/parent substitution accepted'; end if;

  -- The existing accountant can view customers but cannot manage them. This
  -- exercises read-only access without changing any membership or overrides.
  select jsonb_build_object('uid',m.user_id) into strict a from public.company_memberships m
    where m.company_id=c.company_id and m.role='accountant' and m.status='active';
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',a->>'uid')::text,true);
  path:=c.company_id::text||'/customer/'||c.customer_id::text||'/BOS-READ-ONLY.png';
  if not public.record_attachment_path_access(path) or public.record_attachment_path_access(path,true) then
    raise exception 'Customer read-only positive control failed';
  end if;
  accepted:=false;
  begin
    insert into public.record_attachments(company_id,entity_type,entity_id,storage_path,uploaded_by,mime_type,file_size_bytes,original_filename)
    values(c.company_id,'customer',c.customer_id,path,(a->>'uid')::uuid,'image/png',1,'BOS-READ-ONLY.png');
    raise sqlstate 'PZ001';
  exception when sqlstate 'PZ001' then accepted:=true; when insufficient_privilege then null; end;
  if accepted then raise exception 'Read-only customer viewer inserted an attachment'; end if;

  perform set_config('request.jwt.claims','{"role":"authenticated","sub":"329df75a-d91e-4a2d-b8a8-94a1cd4d5cb9"}',true);
  if exists(select 1 from public.record_attachments where id=c.attachment_id)
    or public.record_attachment_path_access(path,true) then raise exception 'Nonmember accepted'; end if;
  if exists(select 1 from pg_proc where oid in (
    'public.record_attachment_parent_access(text,uuid,uuid,boolean)'::regprocedure,
    'public.record_attachment_path_access(text,boolean)'::regprocedure) and prosecdef)
    or has_function_privilege('anon','public.record_attachment_parent_access(text,uuid,uuid,boolean)','execute')
    or has_function_privilege('anon','public.record_attachment_path_access(text,boolean)','execute') then
    raise exception 'Helpers must remain invoker-only and not anonymous RPCs';
  end if;
  perform set_config('bos.audit.attachment_results',rows_result::text,true);
end;
$test$;
select current_setting('bos.audit.attachment_results')::jsonb attachment_results;

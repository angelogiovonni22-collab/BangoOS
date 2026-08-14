begin;

create or replace function public.create_blueprint_sheet_upload(
  project_record_id uuid,
  plan_discipline text,
  plan_sheet_number text,
  plan_title text
) returns table(company_id uuid, blueprint_set_id uuid, blueprint_sheet_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  project_record public.projects%rowtype;
  created_set_id uuid;
  created_sheet_id uuid;
begin
  select * into project_record from public.projects where id = project_record_id;
  if not found then raise exception 'Blueprint project not found'; end if;
  if not public.is_company_member(project_record.company_id) then raise exception 'Blueprint company access denied'; end if;
  if plan_discipline not in ('Architectural','Structural','Civil','Mechanical','Electrical','Plumbing','Fire Protection','Specifications','Permits','Other') then raise exception 'Invalid blueprint discipline'; end if;
  if btrim(plan_sheet_number) = '' or btrim(plan_title) = '' then raise exception 'Sheet number and title are required'; end if;

  insert into public.blueprint_sets(company_id, project_id, name, discipline, created_by)
  values(project_record.company_id, project_record.id, plan_discipline || ' Plan Set', plan_discipline, auth.uid())
  returning id into created_set_id;

  insert into public.blueprint_sheets(company_id, project_id, blueprint_set_id, sheet_number, title, discipline, created_by)
  values(project_record.company_id, project_record.id, created_set_id, btrim(plan_sheet_number), btrim(plan_title), plan_discipline, auth.uid())
  returning id into created_sheet_id;

  return query select project_record.company_id, created_set_id, created_sheet_id;
end;
$$;

create or replace function public.register_initial_blueprint_version(
  sheet_record_id uuid,
  revision_name text,
  object_path text,
  source_filename text,
  source_mime_type text,
  source_file_size bigint
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sheet_record public.blueprint_sheets%rowtype;
  created_version_id uuid;
begin
  select * into sheet_record from public.blueprint_sheets where id = sheet_record_id;
  if not found then raise exception 'Blueprint sheet not found'; end if;
  if not public.is_company_member(sheet_record.company_id) then raise exception 'Blueprint company access denied'; end if;
  if split_part(object_path, '/', 1) <> sheet_record.company_id::text
    or split_part(object_path, '/', 2) <> sheet_record.project_id::text
    or split_part(object_path, '/', 3) <> sheet_record.id::text then raise exception 'Invalid blueprint storage path'; end if;
  if exists(select 1 from public.blueprint_versions where blueprint_sheet_id = sheet_record.id) then raise exception 'Blueprint sheet already has a version'; end if;

  insert into public.blueprint_versions(
    company_id, project_id, blueprint_sheet_id, version_number, revision_label, status,
    storage_path, original_filename, mime_type, file_size_bytes, uploaded_by
  ) values (
    sheet_record.company_id, sheet_record.project_id, sheet_record.id, 1, btrim(revision_name), 'draft',
    object_path, source_filename, source_mime_type, source_file_size, auth.uid()
  ) returning id into created_version_id;
  return created_version_id;
end;
$$;

create or replace function public.register_blueprint_revision(
  sheet_record_id uuid,
  revision_name text,
  object_path text,
  source_filename text,
  source_mime_type text,
  source_file_size bigint,
  revision_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sheet_record public.blueprint_sheets%rowtype;
  next_version integer;
  created_version_id uuid;
begin
  select * into sheet_record from public.blueprint_sheets where id = sheet_record_id;
  if not found then raise exception 'Blueprint sheet not found'; end if;
  if not public.is_company_member(sheet_record.company_id) then raise exception 'Blueprint company access denied'; end if;
  if btrim(revision_name) = '' then raise exception 'Revision label is required'; end if;
  if split_part(object_path, '/', 1) <> sheet_record.company_id::text
    or split_part(object_path, '/', 2) <> sheet_record.project_id::text
    or split_part(object_path, '/', 3) <> sheet_record.id::text then raise exception 'Invalid blueprint storage path'; end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.blueprint_versions where blueprint_sheet_id = sheet_record_id;

  update public.blueprint_versions set status = 'superseded'
  where blueprint_sheet_id = sheet_record_id and status in ('draft','in_review','approved');

  insert into public.blueprint_versions(
    company_id, project_id, blueprint_sheet_id, version_number, revision_label, status,
    storage_path, original_filename, mime_type, file_size_bytes, notes, uploaded_by
  ) values (
    sheet_record.company_id, sheet_record.project_id, sheet_record.id, next_version, btrim(revision_name), 'draft',
    object_path, source_filename, source_mime_type, source_file_size, nullif(btrim(revision_notes), ''), auth.uid()
  ) returning id into created_version_id;
  return created_version_id;
end;
$$;

revoke all on function public.create_blueprint_sheet_upload(uuid,text,text,text) from public, anon;
revoke all on function public.register_initial_blueprint_version(uuid,text,text,text,text,bigint) from public, anon;
revoke all on function public.register_blueprint_revision(uuid,text,text,text,text,bigint,text) from public, anon;
grant execute on function public.create_blueprint_sheet_upload(uuid,text,text,text) to authenticated;
grant execute on function public.register_initial_blueprint_version(uuid,text,text,text,text,bigint) to authenticated;
grant execute on function public.register_blueprint_revision(uuid,text,text,text,text,bigint,text) to authenticated;

commit;

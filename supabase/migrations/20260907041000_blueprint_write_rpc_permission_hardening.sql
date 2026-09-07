begin;

-- Blueprint sheet/revision registration is a write capability. Preserve the
-- existing SECURITY DEFINER implementations behind internal names and require
-- blueprints.manage at the public RPC boundary.
alter function public.create_blueprint_sheet_upload(uuid, text, text, text)
  rename to create_blueprint_sheet_upload_internal;
alter function public.register_initial_blueprint_version(uuid, text, text, text, text, bigint)
  rename to register_initial_blueprint_version_internal;
alter function public.register_blueprint_revision(uuid, text, text, text, text, bigint, text)
  rename to register_blueprint_revision_internal;

revoke all on function public.create_blueprint_sheet_upload_internal(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.register_initial_blueprint_version_internal(uuid, text, text, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.register_blueprint_revision_internal(uuid, text, text, text, text, bigint, text)
  from public, anon, authenticated;

create function public.create_blueprint_sheet_upload(
  project_record_id uuid,
  plan_discipline text,
  plan_sheet_number text,
  plan_title text
)
returns table(company_id uuid, blueprint_set_id uuid, blueprint_sheet_id uuid)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
begin
  select p.company_id into v_company_id
  from public.projects p
  where p.id = project_record_id;

  if v_company_id is null then
    raise exception 'Blueprint project not found';
  end if;

  if auth.uid() is null
     or not public.bos_role_has_permission(v_company_id, 'blueprints.manage', auth.uid()) then
    raise exception 'Not authorized to create blueprint sheet' using errcode = '42501';
  end if;

  return query
  select * from public.create_blueprint_sheet_upload_internal(
    project_record_id,
    plan_discipline,
    plan_sheet_number,
    plan_title
  );
end;
$function$;

create function public.register_initial_blueprint_version(
  sheet_record_id uuid,
  revision_name text,
  object_path text,
  source_filename text,
  source_mime_type text,
  source_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
begin
  select s.company_id into v_company_id
  from public.blueprint_sheets s
  where s.id = sheet_record_id;

  if v_company_id is null then
    raise exception 'Blueprint sheet not found';
  end if;

  if auth.uid() is null
     or not public.bos_role_has_permission(v_company_id, 'blueprints.manage', auth.uid()) then
    raise exception 'Not authorized to register blueprint version' using errcode = '42501';
  end if;

  return public.register_initial_blueprint_version_internal(
    sheet_record_id,
    revision_name,
    object_path,
    source_filename,
    source_mime_type,
    source_file_size
  );
end;
$function$;

create function public.register_blueprint_revision(
  sheet_record_id uuid,
  revision_name text,
  object_path text,
  source_filename text,
  source_mime_type text,
  source_file_size bigint,
  revision_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
begin
  select s.company_id into v_company_id
  from public.blueprint_sheets s
  where s.id = sheet_record_id;

  if v_company_id is null then
    raise exception 'Blueprint sheet not found';
  end if;

  if auth.uid() is null
     or not public.bos_role_has_permission(v_company_id, 'blueprints.manage', auth.uid()) then
    raise exception 'Not authorized to register blueprint revision' using errcode = '42501';
  end if;

  return public.register_blueprint_revision_internal(
    sheet_record_id,
    revision_name,
    object_path,
    source_filename,
    source_mime_type,
    source_file_size,
    revision_notes
  );
end;
$function$;

revoke all on function public.create_blueprint_sheet_upload(uuid, text, text, text) from public, anon;
revoke all on function public.register_initial_blueprint_version(uuid, text, text, text, text, bigint) from public, anon;
revoke all on function public.register_blueprint_revision(uuid, text, text, text, text, bigint, text) from public, anon;

grant execute on function public.create_blueprint_sheet_upload(uuid, text, text, text) to authenticated;
grant execute on function public.register_initial_blueprint_version(uuid, text, text, text, text, bigint) to authenticated;
grant execute on function public.register_blueprint_revision(uuid, text, text, text, text, bigint, text) to authenticated;

commit;

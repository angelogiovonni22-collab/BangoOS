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
  normalized_sheet_number text := lower(btrim(plan_sheet_number));
  created_set_id uuid;
  created_sheet_id uuid;
begin
  select * into project_record from public.projects where id = project_record_id;
  if not found then raise exception 'Blueprint project not found'; end if;
  if not public.is_company_member(project_record.company_id) then raise exception 'Blueprint company access denied'; end if;
  if plan_discipline not in ('Architectural','Structural','Civil','Mechanical','Electrical','Plumbing','Fire Protection','Specifications','Permits','Other') then raise exception 'Invalid blueprint discipline'; end if;
  if normalized_sheet_number = '' or btrim(plan_title) = '' then raise exception 'Sheet number and title are required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(project_record.id::text || ':' || plan_discipline || ':' || normalized_sheet_number, 0));
  if exists (
    select 1 from public.blueprint_sheets sheet
    where sheet.project_id = project_record.id
      and sheet.discipline = plan_discipline
      and lower(btrim(sheet.sheet_number)) = normalized_sheet_number
  ) then
    raise exception 'Sheet % already exists in %. Select it and use Upload revision instead.', btrim(plan_sheet_number), plan_discipline;
  end if;

  insert into public.blueprint_sets(company_id, project_id, name, discipline, created_by)
  values(project_record.company_id, project_record.id, plan_discipline || ' Plan Set', plan_discipline, auth.uid())
  returning id into created_set_id;

  insert into public.blueprint_sheets(company_id, project_id, blueprint_set_id, sheet_number, title, discipline, created_by)
  values(project_record.company_id, project_record.id, created_set_id, btrim(plan_sheet_number), btrim(plan_title), plan_discipline, auth.uid())
  returning id into created_sheet_id;

  return query select project_record.company_id, created_set_id, created_sheet_id;
end;
$$;

revoke all on function public.create_blueprint_sheet_upload(uuid,text,text,text) from public, anon;
grant execute on function public.create_blueprint_sheet_upload(uuid,text,text,text) to authenticated;

commit;

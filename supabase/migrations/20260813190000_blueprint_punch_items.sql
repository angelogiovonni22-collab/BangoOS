begin;

create or replace function public.create_punch_item_from_blueprint_issue(
  p_company_id uuid,
  p_project_id uuid,
  p_blueprint_version_id uuid,
  p_annotation_id uuid
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_annotation public.blueprint_annotations%rowtype;
  v_punch_item_id uuid;
  v_page text;
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint punch-item creation is not authorized.' using errcode = '42501';
  end if;

  select * into v_annotation from public.blueprint_annotations
  where id = p_annotation_id and company_id = p_company_id
    and project_id = p_project_id and blueprint_version_id = p_blueprint_version_id
    and annotation_type = 'pin';
  if not found then
    raise exception 'Blueprint issue pin was not found.' using errcode = 'P0002';
  end if;

  select target_id into v_punch_item_id from public.blueprint_operational_links
  where company_id = p_company_id and annotation_id = p_annotation_id
    and target_type = 'punch_item'
  order by created_at limit 1;
  if v_punch_item_id is not null then return v_punch_item_id; end if;

  v_page := coalesce(v_annotation.geometry->>'page', '1');
  insert into public.project_punch_items (
    company_id, project_id, title, description, location, status, priority,
    notes, created_by, updated_by, idempotency_key
  ) values (
    p_company_id, p_project_id,
    coalesce(nullif(btrim(v_annotation.content), ''), 'Blueprint field issue'),
    'Field correction created from a coordinate-pinned Blueprint issue.',
    'Blueprint page ' || v_page,
    'open', 'high',
    'Source annotation ' || p_annotation_id::text || ' · revision ' || p_blueprint_version_id::text,
    auth.uid(), auth.uid(), 'blueprint:' || p_annotation_id::text
  ) returning id into v_punch_item_id;

  insert into public.blueprint_operational_links (
    company_id, project_id, blueprint_version_id, annotation_id, target_type, target_id, created_by
  ) values (
    p_company_id, p_project_id, p_blueprint_version_id, p_annotation_id,
    'punch_item', v_punch_item_id, auth.uid()
  );
  return v_punch_item_id;
end;
$$;

revoke all on function public.create_punch_item_from_blueprint_issue(uuid, uuid, uuid, uuid) from public;
grant execute on function public.create_punch_item_from_blueprint_issue(uuid, uuid, uuid, uuid) to authenticated;

commit;

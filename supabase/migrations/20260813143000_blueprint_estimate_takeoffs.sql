begin;

create or replace function public.create_estimate_line_item_from_blueprint_takeoff(
  p_company_id uuid,
  p_project_id uuid,
  p_blueprint_version_id uuid,
  p_annotation_id uuid,
  p_estimate_id uuid
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_annotation public.blueprint_annotations%rowtype;
  v_line_item_id uuid;
  v_quantity numeric(14,4);
  v_unit text;
  v_source_unit text;
  v_sort_order integer;
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint takeoff export is not authorized.' using errcode = '42501';
  end if;

  perform 1 from public.estimates
  where id = p_estimate_id and company_id = p_company_id and project_id = p_project_id;
  if not found then
    raise exception 'Project estimate was not found.' using errcode = 'P0002';
  end if;

  select * into v_annotation from public.blueprint_annotations
  where id = p_annotation_id and company_id = p_company_id
    and project_id = p_project_id and blueprint_version_id = p_blueprint_version_id
    and annotation_type in ('distance', 'area');
  if not found then
    raise exception 'Blueprint distance or area takeoff was not found.' using errcode = 'P0002';
  end if;

  select target_id into v_line_item_id from public.blueprint_operational_links
  where company_id = p_company_id and annotation_id = p_annotation_id
    and target_type = 'estimate_line_item'
  order by created_at limit 1;
  if v_line_item_id is not null then return v_line_item_id; end if;

  v_quantity := nullif(v_annotation.geometry->>'value', '')::numeric;
  v_source_unit := lower(coalesce(v_annotation.geometry->>'unit', ''));
  if v_quantity is null or v_quantity <= 0 then
    raise exception 'Blueprint takeoff does not contain a valid calibrated quantity.' using errcode = '22023';
  end if;

  if v_annotation.annotation_type = 'distance' then
    v_unit := 'linear_foot';
    if v_source_unit = 'm' then v_quantity := v_quantity * 3.280839895; end if;
  else
    v_unit := 'square_foot';
    if v_source_unit in ('m²', 'm2') then v_quantity := v_quantity * 10.763910417; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_estimate_id::text));
  select coalesce(max(sort_order), -1) + 1 into v_sort_order
  from public.estimate_line_items where company_id = p_company_id and estimate_id = p_estimate_id;

  insert into public.estimate_line_items (
    company_id, estimate_id, sort_order, category, description, quantity, unit,
    unit_cost, markup_percent, unit_price, line_total, notes
  ) values (
    p_company_id, p_estimate_id, v_sort_order, 'other',
    case when v_annotation.annotation_type = 'distance' then 'Blueprint distance takeoff' else 'Blueprint area takeoff' end,
    round(v_quantity, 4), v_unit, 0, 0, 0, 0,
    'Source annotation ' || p_annotation_id::text || ' · revision ' || p_blueprint_version_id::text
  ) returning id into v_line_item_id;

  insert into public.blueprint_operational_links (
    company_id, project_id, blueprint_version_id, annotation_id, target_type, target_id, created_by
  ) values (
    p_company_id, p_project_id, p_blueprint_version_id, p_annotation_id,
    'estimate_line_item', v_line_item_id, auth.uid()
  );
  return v_line_item_id;
end;
$$;

revoke all on function public.create_estimate_line_item_from_blueprint_takeoff(uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function public.create_estimate_line_item_from_blueprint_takeoff(uuid, uuid, uuid, uuid, uuid) to authenticated;

commit;

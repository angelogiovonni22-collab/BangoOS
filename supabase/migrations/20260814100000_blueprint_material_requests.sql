begin;

alter table public.blueprint_operational_links drop constraint if exists blueprint_operational_links_target_type_check;
alter table public.blueprint_operational_links add constraint blueprint_operational_links_target_type_check
  check (target_type in ('task','estimate_line_item','change_order','rfi','punch_item','workforce_assignment','submittal','material_request'));

alter table public.material_requests add column if not exists source_takeoff jsonb null;

create or replace function public.create_material_request_from_blueprint_takeoff(
  p_company_id uuid, p_project_id uuid, p_blueprint_version_id uuid, p_annotation_id uuid
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_annotation public.blueprint_annotations%rowtype;
  v_request_id uuid;
  v_request_number text;
  v_quantity numeric;
  v_unit text;
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint material request creation is not authorized.' using errcode='42501';
  end if;

  select * into v_annotation from public.blueprint_annotations
  where id=p_annotation_id and company_id=p_company_id and project_id=p_project_id
    and blueprint_version_id=p_blueprint_version_id and annotation_type in ('distance','area')
    and takeoff_category='materials';
  if not found then
    raise exception 'A materials-classified Blueprint takeoff was not found.' using errcode='P0002';
  end if;

  select target_id into v_request_id from public.blueprint_operational_links
  where company_id=p_company_id and annotation_id=p_annotation_id and target_type='material_request'
  order by created_at limit 1;
  if v_request_id is not null then return v_request_id; end if;

  v_quantity := nullif(v_annotation.geometry->>'value','')::numeric;
  v_unit := coalesce(nullif(v_annotation.geometry->>'unit',''), case when v_annotation.annotation_type='area' then 'square units' else 'linear units' end);
  if v_quantity is null or v_quantity <= 0 then
    raise exception 'Blueprint takeoff does not contain a valid calibrated quantity.' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company_id::text || ':material-request'));
  v_request_number := 'MR-BP-' || to_char(clock_timestamp(),'YYYYMMDD') || '-' ||
    lpad((coalesce((select count(*) from public.material_requests where company_id=p_company_id and created_at::date=current_date),0)+1)::text,4,'0');

  insert into public.material_requests(
    company_id,request_number,project_id,priority,status,notes,source_takeoff,
    requested_by,created_by,updated_by
  ) values (
    p_company_id,v_request_number,p_project_id,'normal','submitted',
    coalesce(nullif(btrim(v_annotation.takeoff_name),''),'Blueprint material takeoff') ||
      ' · ' || round(v_quantity,4)::text || ' ' || v_unit,
    jsonb_build_object('annotationId',p_annotation_id,'blueprintVersionId',p_blueprint_version_id,
      'quantity',round(v_quantity,4),'unit',v_unit,'costCodeId',v_annotation.cost_code_id),
    auth.uid(),auth.uid(),auth.uid()
  ) returning id into v_request_id;

  insert into public.blueprint_operational_links(
    company_id,project_id,blueprint_version_id,annotation_id,target_type,target_id,created_by
  ) values (p_company_id,p_project_id,p_blueprint_version_id,p_annotation_id,'material_request',v_request_id,auth.uid());
  return v_request_id;
end;$$;

revoke all on function public.create_material_request_from_blueprint_takeoff(uuid,uuid,uuid,uuid) from public;
grant execute on function public.create_material_request_from_blueprint_takeoff(uuid,uuid,uuid,uuid) to authenticated;

commit;

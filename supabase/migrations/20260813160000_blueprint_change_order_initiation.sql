begin;

create or replace function public.create_change_order_from_blueprint_issue(
  p_company_id uuid,
  p_project_id uuid,
  p_blueprint_version_id uuid,
  p_annotation_id uuid
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_annotation public.blueprint_annotations%rowtype;
  v_change_order_id uuid;
  v_change_order_number text;
  v_customer_id uuid;
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint change-order creation is not authorized.' using errcode = '42501';
  end if;

  select * into v_annotation from public.blueprint_annotations
  where id = p_annotation_id and company_id = p_company_id
    and project_id = p_project_id and blueprint_version_id = p_blueprint_version_id
    and annotation_type = 'pin';
  if not found then
    raise exception 'Blueprint issue pin was not found.' using errcode = 'P0002';
  end if;

  select target_id into v_change_order_id from public.blueprint_operational_links
  where company_id = p_company_id and annotation_id = p_annotation_id
    and target_type = 'change_order'
  order by created_at limit 1;
  if v_change_order_id is not null then return v_change_order_id; end if;

  select customer_id into v_customer_id from public.projects
  where id = p_project_id and company_id = p_company_id;
  if not found then
    raise exception 'Project was not found.' using errcode = 'P0002';
  end if;

  v_change_order_number := public.allocate_change_order_number(p_company_id);
  insert into public.change_orders (
    company_id, change_order_number, title, description, status,
    customer_id, project_id, requested_by, prepared_by, requested_date,
    reason, internal_notes, created_by, updated_by
  ) values (
    p_company_id, v_change_order_number,
    coalesce(nullif(btrim(v_annotation.content), ''), 'Blueprint issue impact'),
    'Potential scope, cost, or schedule impact identified on a Blueprint issue pin.',
    'draft', v_customer_id, p_project_id, auth.uid(), auth.uid(), current_date,
    'Blueprint issue',
    'Source annotation ' || p_annotation_id::text || ' · revision ' || p_blueprint_version_id::text,
    auth.uid(), auth.uid()
  ) returning id into v_change_order_id;

  insert into public.blueprint_operational_links (
    company_id, project_id, blueprint_version_id, annotation_id, target_type, target_id, created_by
  ) values (
    p_company_id, p_project_id, p_blueprint_version_id, p_annotation_id,
    'change_order', v_change_order_id, auth.uid()
  );
  return v_change_order_id;
end;
$$;

revoke all on function public.create_change_order_from_blueprint_issue(uuid, uuid, uuid, uuid) from public;
grant execute on function public.create_change_order_from_blueprint_issue(uuid, uuid, uuid, uuid) to authenticated;

commit;

begin;

alter table public.blueprint_operational_links
  drop constraint if exists blueprint_operational_links_target_type_check;
alter table public.blueprint_operational_links
  add constraint blueprint_operational_links_target_type_check
  check (target_type in ('task', 'estimate_line_item', 'change_order', 'rfi', 'punch_item', 'workforce_assignment'));

create or replace function public.assign_blueprint_issue_to_workforce(
  p_company_id uuid,
  p_project_id uuid,
  p_blueprint_version_id uuid,
  p_annotation_id uuid,
  p_assignment_type text,
  p_assignee_id uuid
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_annotation public.blueprint_annotations%rowtype;
  v_assignment_id uuid;
  v_starts_at timestamptz := date_trunc('hour', now());
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint workforce assignment is not authorized.' using errcode = '42501';
  end if;
  if p_assignment_type not in ('employee', 'crew') then
    raise exception 'Assignment type must be employee or crew.' using errcode = '22023';
  end if;

  select * into v_annotation from public.blueprint_annotations
  where id = p_annotation_id and company_id = p_company_id
    and project_id = p_project_id and blueprint_version_id = p_blueprint_version_id
    and annotation_type = 'pin';
  if not found then
    raise exception 'Blueprint issue pin was not found.' using errcode = 'P0002';
  end if;

  if p_assignment_type = 'employee' then
    perform 1 from public.employees where id = p_assignee_id and company_id = p_company_id and employment_status = 'active';
  else
    perform 1 from public.crews where id = p_assignee_id and company_id = p_company_id and status = 'active';
  end if;
  if not found then
    raise exception 'Active workforce assignee was not found.' using errcode = 'P0002';
  end if;

  select target_id into v_assignment_id from public.blueprint_operational_links
  where company_id = p_company_id and annotation_id = p_annotation_id
    and target_type = 'workforce_assignment'
  order by created_at limit 1;
  if v_assignment_id is not null then return v_assignment_id; end if;

  insert into public.workforce_assignments (
    company_id, assignment_type, crew_id, employee_id, project_id, title,
    description, starts_at, ends_at, planned_hours, status, source_type,
    source_id, notes, created_by, updated_by
  ) values (
    p_company_id, p_assignment_type,
    case when p_assignment_type = 'crew' then p_assignee_id end,
    case when p_assignment_type = 'employee' then p_assignee_id end,
    p_project_id,
    coalesce(nullif(btrim(v_annotation.content), ''), 'Blueprint issue assignment'),
    'Field responsibility assigned from a Blueprint issue pin.',
    v_starts_at, v_starts_at + interval '8 hours', 8, 'planned', 'project',
    p_annotation_id::text,
    'Revision ' || p_blueprint_version_id::text,
    auth.uid(), auth.uid()
  ) returning id into v_assignment_id;

  insert into public.blueprint_operational_links (
    company_id, project_id, blueprint_version_id, annotation_id, target_type, target_id, created_by
  ) values (
    p_company_id, p_project_id, p_blueprint_version_id, p_annotation_id,
    'workforce_assignment', v_assignment_id, auth.uid()
  );
  return v_assignment_id;
end;
$$;

revoke all on function public.assign_blueprint_issue_to_workforce(uuid, uuid, uuid, uuid, text, uuid) from public;
grant execute on function public.assign_blueprint_issue_to_workforce(uuid, uuid, uuid, uuid, text, uuid) to authenticated;

commit;

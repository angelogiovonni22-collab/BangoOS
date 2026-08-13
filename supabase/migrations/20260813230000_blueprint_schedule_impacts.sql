begin;

create or replace function public.schedule_blueprint_issue_task(
  p_company_id uuid,
  p_project_id uuid,
  p_blueprint_version_id uuid,
  p_annotation_id uuid,
  p_planned_start date,
  p_planned_finish date
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_task_id uuid;
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint task scheduling is not authorized.' using errcode = '42501';
  end if;
  if p_planned_start is null or p_planned_finish is null or p_planned_finish < p_planned_start then
    raise exception 'Planned finish must be on or after planned start.' using errcode = '22023';
  end if;
  perform 1 from public.blueprint_annotations where id = p_annotation_id
    and company_id = p_company_id and project_id = p_project_id
    and blueprint_version_id = p_blueprint_version_id and annotation_type = 'pin';
  if not found then raise exception 'Blueprint issue pin was not found.' using errcode = 'P0002'; end if;

  select target_id into v_task_id from public.blueprint_operational_links
  where company_id = p_company_id and project_id = p_project_id
    and blueprint_version_id = p_blueprint_version_id and annotation_id = p_annotation_id
    and target_type = 'task' order by created_at limit 1;
  if v_task_id is null then raise exception 'Create a linked task before scheduling this issue.' using errcode = 'P0002'; end if;

  update public.tasks set planned_start = p_planned_start, planned_finish = p_planned_finish,
    estimated_completion_date = p_planned_finish, updated_at = now()
  where id = v_task_id and company_id = p_company_id and project_id = p_project_id;
  if not found then raise exception 'Linked project task was not found.' using errcode = 'P0002'; end if;

  insert into public.workflow_events (
    company_id, workflow_name, event_type, current_state, next_state,
    actor_profile_id, reference_entity, reference_id, source_module,
    payload, metadata, idempotency_key
  ) values (
    p_company_id, 'blueprint_issue_schedule', 'schedule.updated', null, 'planned',
    auth.uid(), 'task', v_task_id, 'scheduling',
    jsonb_build_object('project_id', p_project_id, 'annotation_id', p_annotation_id, 'blueprint_version_id', p_blueprint_version_id, 'planned_start', p_planned_start, 'planned_finish', p_planned_finish),
    jsonb_build_object('project_id', p_project_id),
    'blueprint:schedule:' || p_annotation_id::text || ':' || p_planned_start::text || ':' || p_planned_finish::text
  ) on conflict (company_id, event_type, idempotency_key) where idempotency_key is not null do nothing;
  return v_task_id;
end;
$$;

revoke all on function public.schedule_blueprint_issue_task(uuid, uuid, uuid, uuid, date, date) from public;
grant execute on function public.schedule_blueprint_issue_task(uuid, uuid, uuid, uuid, date, date) to authenticated;

commit;

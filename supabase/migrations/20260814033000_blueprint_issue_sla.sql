begin;

alter table public.blueprint_annotations
  add column if not exists priority text not null default 'medium',
  add column if not exists due_at timestamptz null,
  add column if not exists escalated_at timestamptz null;

alter table public.blueprint_annotations
  drop constraint if exists blueprint_annotations_priority_check,
  add constraint blueprint_annotations_priority_check check (priority in ('low', 'medium', 'high', 'critical'));

create index if not exists blueprint_annotations_open_due_idx
  on public.blueprint_annotations(company_id, project_id, due_at)
  where annotation_type = 'pin' and status = 'open' and due_at is not null;

create or replace function public.set_blueprint_issue_sla(
  p_company_id uuid, p_project_id uuid, p_blueprint_version_id uuid, p_annotation_id uuid,
  p_priority text, p_due_at timestamptz
) returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint issue SLA update is not authorized.' using errcode = '42501';
  end if;
  if p_priority not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Invalid Blueprint issue priority.' using errcode = '22023';
  end if;
  update public.blueprint_annotations set priority = p_priority, due_at = p_due_at,
    escalated_at = case when due_at is distinct from p_due_at then null else escalated_at end,
    updated_at = now()
  where id = p_annotation_id and company_id = p_company_id and project_id = p_project_id
    and blueprint_version_id = p_blueprint_version_id and annotation_type = 'pin';
  if not found then raise exception 'Blueprint issue pin was not found.' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.set_blueprint_issue_sla(uuid, uuid, uuid, uuid, text, timestamptz) from public;
grant execute on function public.set_blueprint_issue_sla(uuid, uuid, uuid, uuid, text, timestamptz) to authenticated;

create or replace function public.evaluate_blueprint_issue_slas(p_company_id uuid, p_project_id uuid default null)
returns integer language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_count integer := 0; v_issue record;
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint issue SLA evaluation is not authorized.' using errcode = '42501';
  end if;
  for v_issue in
    select id, project_id, blueprint_version_id, priority, due_at, geometry
    from public.blueprint_annotations where company_id = p_company_id
      and (p_project_id is null or project_id = p_project_id)
      and annotation_type = 'pin' and status = 'open' and due_at < now() and escalated_at is null
    for update skip locked
  loop
    insert into public.workflow_events (
      company_id, workflow_name, event_type, current_state, next_state,
      actor_profile_id, reference_entity, reference_id, source_module,
      payload, metadata, idempotency_key
    ) values (
      p_company_id, 'blueprint_issue_sla', 'blueprint.issue_overdue', 'open', 'overdue',
      auth.uid(), 'blueprint_annotation', v_issue.id, 'blueprints',
      jsonb_build_object('project_id', v_issue.project_id, 'blueprint_version_id', v_issue.blueprint_version_id, 'annotation_id', v_issue.id, 'priority', v_issue.priority, 'due_at', v_issue.due_at, 'page_number', greatest(coalesce((v_issue.geometry->>'page')::integer, 1), 1)),
      jsonb_build_object('project_id', v_issue.project_id, 'severity', case when v_issue.priority = 'critical' then 'critical' else 'attention' end),
      'blueprint:issue-overdue:' || v_issue.id::text || ':' || extract(epoch from v_issue.due_at)::text
    ) on conflict (company_id, event_type, idempotency_key) where idempotency_key is not null do nothing;
    update public.blueprint_annotations set escalated_at = now(), updated_at = now() where id = v_issue.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.evaluate_blueprint_issue_slas(uuid, uuid) from public;
grant execute on function public.evaluate_blueprint_issue_slas(uuid, uuid) to authenticated;

commit;

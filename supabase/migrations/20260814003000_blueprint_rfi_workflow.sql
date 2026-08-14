begin;

alter table public.project_communications
  drop constraint if exists project_communications_channel_check;
alter table public.project_communications
  add constraint project_communications_channel_check check (
    channel in ('portal', 'email', 'sms', 'phone_note', 'in_person_note', 'system_notification', 'rfi')
  );

create or replace function public.create_rfi_from_blueprint_issue(
  p_company_id uuid,
  p_project_id uuid,
  p_blueprint_version_id uuid,
  p_annotation_id uuid
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_annotation public.blueprint_annotations%rowtype;
  v_rfi_id uuid;
  v_sequence integer;
  v_rfi_number text;
  v_page integer;
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint RFI creation is not authorized.' using errcode = '42501';
  end if;

  select * into v_annotation from public.blueprint_annotations
  where id = p_annotation_id and company_id = p_company_id
    and project_id = p_project_id and blueprint_version_id = p_blueprint_version_id
    and annotation_type = 'pin';
  if not found then
    raise exception 'Blueprint issue pin was not found.' using errcode = 'P0002';
  end if;

  select target_id into v_rfi_id from public.blueprint_operational_links
  where company_id = p_company_id and project_id = p_project_id
    and blueprint_version_id = p_blueprint_version_id and annotation_id = p_annotation_id
    and target_type = 'rfi' order by created_at limit 1;
  if v_rfi_id is not null then return v_rfi_id; end if;

  perform pg_advisory_xact_lock(hashtext('project-rfi:' || p_project_id::text));
  select coalesce(max(case when metadata->>'sequence' ~ '^[0-9]+$' then (metadata->>'sequence')::integer end), 0) + 1
    into v_sequence from public.project_communications
    where company_id = p_company_id and project_id = p_project_id and channel = 'rfi';
  v_rfi_number := 'RFI-' || lpad(v_sequence::text, 4, '0');
  v_page := greatest(coalesce((v_annotation.geometry->>'page')::integer, 1), 1);

  insert into public.project_communications (
    company_id, project_id, channel, direction, subject, message, status,
    created_by, correlation_id, metadata
  ) values (
    p_company_id, p_project_id, 'rfi', 'internal',
    v_rfi_number || ' · ' || coalesce(nullif(btrim(v_annotation.content), ''), 'Blueprint clarification'),
    coalesce(nullif(btrim(v_annotation.content), ''), 'Clarification requested from Blueprint issue pin.'),
    'draft', auth.uid(), 'blueprint:rfi:' || p_annotation_id::text,
    jsonb_build_object(
      'rfi_number', v_rfi_number, 'sequence', v_sequence, 'source', 'blueprint_issue',
      'annotation_id', p_annotation_id, 'blueprint_version_id', p_blueprint_version_id,
      'page_number', v_page, 'coordinates', v_annotation.geometry
    )
  ) returning id into v_rfi_id;

  insert into public.blueprint_operational_links (
    company_id, project_id, blueprint_version_id, annotation_id, target_type, target_id, created_by
  ) values (
    p_company_id, p_project_id, p_blueprint_version_id, p_annotation_id, 'rfi', v_rfi_id, auth.uid()
  );

  insert into public.workflow_events (
    company_id, workflow_name, event_type, current_state, next_state,
    actor_profile_id, reference_entity, reference_id, source_module,
    payload, metadata, idempotency_key
  ) values (
    p_company_id, 'blueprint_issue_rfi', 'rfi.created', null, 'draft',
    auth.uid(), 'project_communication', v_rfi_id, 'projects',
    jsonb_build_object('project_id', p_project_id, 'rfi_number', v_rfi_number, 'annotation_id', p_annotation_id, 'blueprint_version_id', p_blueprint_version_id, 'page_number', v_page),
    jsonb_build_object('project_id', p_project_id, 'source', 'blueprint_issue'),
    'blueprint:rfi:' || p_annotation_id::text
  ) on conflict (company_id, event_type, idempotency_key) where idempotency_key is not null do nothing;

  return v_rfi_id;
end;
$$;

revoke all on function public.create_rfi_from_blueprint_issue(uuid, uuid, uuid, uuid) from public;
grant execute on function public.create_rfi_from_blueprint_issue(uuid, uuid, uuid, uuid) to authenticated;

commit;

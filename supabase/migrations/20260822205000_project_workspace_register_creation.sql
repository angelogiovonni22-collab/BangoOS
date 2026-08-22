begin;

create or replace function public.create_project_rfi(
  p_company_id uuid,
  p_project_id uuid,
  p_title text,
  p_message text
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_sequence integer;
  v_number text;
begin
  if auth.uid() is null
    or not public.has_company_role(p_company_id, array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','employee'])
    or not public.blueprint_project_belongs_to_company(p_project_id, p_company_id)
  then
    raise exception 'Project RFI creation is not authorized.' using errcode = '42501';
  end if;

  if nullif(btrim(p_title), '') is null or nullif(btrim(p_message), '') is null then
    raise exception 'RFI title and message are required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('project-rfi:' || p_project_id::text));
  select coalesce(max(case when metadata->>'sequence' ~ '^[0-9]+$' then (metadata->>'sequence')::integer end), 0) + 1
    into v_sequence
    from public.project_communications
    where company_id = p_company_id and project_id = p_project_id and channel = 'rfi';
  v_number := 'RFI-' || lpad(v_sequence::text, 4, '0');

  insert into public.project_communications (
    company_id, project_id, channel, direction, subject, message, status,
    created_by, correlation_id, metadata
  ) values (
    p_company_id, p_project_id, 'rfi', 'internal',
    v_number || ' · ' || btrim(p_title), btrim(p_message), 'draft', auth.uid(),
    'project:rfi:' || p_project_id::text || ':' || v_sequence::text,
    jsonb_build_object('rfi_number', v_number, 'sequence', v_sequence, 'source', 'project_workspace')
  ) returning id into v_id;

  insert into public.workflow_events (
    company_id, workflow_name, event_type, current_state, next_state,
    actor_profile_id, reference_entity, reference_id, source_module,
    payload, metadata, idempotency_key
  ) values (
    p_company_id, 'project_rfi', 'rfi.created', null, 'draft', auth.uid(),
    'project_communication', v_id, 'projects',
    jsonb_build_object('project_id', p_project_id, 'rfi_number', v_number, 'title', btrim(p_title)),
    jsonb_build_object('project_id', p_project_id, 'source', 'project_workspace'),
    'project:rfi:' || v_id::text
  );

  return v_id;
end;
$$;

create or replace function public.create_project_submittal(
  p_company_id uuid,
  p_project_id uuid,
  p_title text,
  p_description text default null,
  p_discipline text default 'General',
  p_due_date date default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_number integer;
begin
  if auth.uid() is null
    or not public.has_company_role(p_company_id, array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','employee'])
    or not public.blueprint_project_belongs_to_company(p_project_id, p_company_id)
  then
    raise exception 'Project submittal creation is not authorized.' using errcode = '42501';
  end if;

  if nullif(btrim(p_title), '') is null then
    raise exception 'Submittal title is required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('project-submittal:' || p_project_id::text));
  select coalesce(max(submittal_number), 0) + 1 into v_number
    from public.project_submittals
    where company_id = p_company_id and project_id = p_project_id;

  insert into public.project_submittals (
    company_id, project_id, submittal_number, title, description,
    discipline, status, due_date, created_by
  ) values (
    p_company_id, p_project_id, v_number, btrim(p_title), nullif(btrim(p_description), ''),
    coalesce(nullif(btrim(p_discipline), ''), 'General'), 'draft', p_due_date, auth.uid()
  ) returning id into v_id;

  insert into public.workflow_events (
    company_id, workflow_name, event_type, current_state, next_state,
    actor_profile_id, reference_entity, reference_id, source_module,
    payload, metadata, idempotency_key
  ) values (
    p_company_id, 'project_submittal', 'submittal.created', null, 'draft', auth.uid(),
    'project_submittal', v_id, 'projects',
    jsonb_build_object('project_id', p_project_id, 'submittal_number', v_number, 'title', btrim(p_title)),
    jsonb_build_object('project_id', p_project_id, 'source', 'project_workspace'),
    'project:submittal:' || v_id::text
  );

  return v_id;
end;
$$;

revoke all on function public.create_project_rfi(uuid, uuid, text, text) from public;
grant execute on function public.create_project_rfi(uuid, uuid, text, text) to authenticated;
revoke all on function public.create_project_submittal(uuid, uuid, text, text, text, date) from public;
grant execute on function public.create_project_submittal(uuid, uuid, text, text, text, date) to authenticated;

commit;

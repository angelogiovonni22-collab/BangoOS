begin;

create or replace function public.publish_blueprint_revision_status_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event_type text;
begin
  if old.status = new.status then return new; end if;
  v_event_type := case new.status
    when 'in_review' then 'blueprint.revision_submitted'
    when 'approved' then 'blueprint.revision_approved'
    when 'superseded' then 'blueprint.revision_superseded'
    else null
  end;
  if v_event_type is null then return new; end if;
  insert into public.workflow_events (
    company_id, workflow_name, event_type, current_state, next_state,
    actor_profile_id, reference_entity, reference_id, source_module,
    payload, metadata, idempotency_key
  ) values (
    new.company_id, 'blueprint_revision', v_event_type, old.status, new.status,
    auth.uid(), 'blueprint_version', new.id, 'documents',
    jsonb_build_object('project_id', new.project_id, 'blueprint_sheet_id', new.blueprint_sheet_id, 'revision_label', new.revision_label),
    jsonb_build_object('project_id', new.project_id),
    v_event_type || ':' || new.id::text || ':' || new.status
  ) on conflict (company_id, event_type, idempotency_key) where idempotency_key is not null do nothing;
  return new;
end;
$$;

drop trigger if exists trg_blueprint_revision_status_event on public.blueprint_versions;
create trigger trg_blueprint_revision_status_event
after update of status on public.blueprint_versions
for each row execute function public.publish_blueprint_revision_status_event();

create or replace function public.publish_blueprint_revision_ack_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.workflow_events (
    company_id, workflow_name, event_type, current_state, next_state,
    actor_profile_id, reference_entity, reference_id, source_module,
    payload, metadata, idempotency_key
  ) values (
    new.company_id, 'blueprint_revision', 'blueprint.revision_acknowledged', null, 'acknowledged',
    new.acknowledged_by, 'blueprint_version', new.blueprint_version_id, 'documents',
    jsonb_build_object('project_id', new.project_id, 'acknowledged_by', new.acknowledged_by),
    jsonb_build_object('project_id', new.project_id),
    'blueprint.revision_acknowledged:' || new.blueprint_version_id::text || ':' || new.acknowledged_by::text
  ) on conflict (company_id, event_type, idempotency_key) where idempotency_key is not null do nothing;
  return new;
end;
$$;

drop trigger if exists trg_blueprint_revision_ack_event on public.blueprint_revision_acknowledgments;
create trigger trg_blueprint_revision_ack_event
after insert on public.blueprint_revision_acknowledgments
for each row execute function public.publish_blueprint_revision_ack_event();

commit;

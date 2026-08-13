begin;

create or replace function public.recompute_blueprint_issue_status(p_annotation_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  select case
    when count(*) = 0 then null
    when bool_and(terminal) then 'resolved'
    else 'open'
  end into v_status
  from (
    select t.status in ('completed', 'cancelled') as terminal
      from public.blueprint_operational_links l join public.tasks t on l.target_type = 'task' and t.id = l.target_id and t.company_id = l.company_id
      where l.annotation_id = p_annotation_id
    union all
    select p.status in ('completed', 'cancelled')
      from public.blueprint_operational_links l join public.project_punch_items p on l.target_type = 'punch_item' and p.id = l.target_id and p.company_id = l.company_id
      where l.annotation_id = p_annotation_id
    union all
    select w.status in ('completed', 'cancelled')
      from public.blueprint_operational_links l join public.workforce_assignments w on l.target_type = 'workforce_assignment' and w.id = l.target_id and w.company_id = l.company_id
      where l.annotation_id = p_annotation_id
    union all
    select c.status in ('approved', 'rejected', 'invoiced', 'void')
      from public.blueprint_operational_links l join public.change_orders c on l.target_type = 'change_order' and c.id = l.target_id and c.company_id = l.company_id
      where l.annotation_id = p_annotation_id
    union all
    select r.status in ('delivered', 'cancelled', 'logged_only')
      from public.blueprint_operational_links l join public.project_communications r on l.target_type = 'rfi' and r.id = l.target_id and r.company_id = l.company_id and r.channel = 'rfi'
      where l.annotation_id = p_annotation_id
  ) linked_records;

  if v_status is not null then
    update public.blueprint_annotations set status = v_status, updated_at = now()
      where id = p_annotation_id and annotation_type = 'pin' and status is distinct from v_status;
  end if;
end;
$$;

revoke all on function public.recompute_blueprint_issue_status(uuid) from public, anon, authenticated;

create or replace function public.sync_blueprint_issue_from_operational_record()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_annotation_id uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  -- An annotation-driven cascade must not immediately roll the same annotation back
  -- while its linked execution records are being updated inside nested triggers.
  if pg_trigger_depth() > 1 then return new; end if;
  for v_annotation_id in
    select annotation_id from public.blueprint_operational_links
      where company_id = new.company_id and target_type = tg_argv[0] and target_id = new.id
  loop
    perform public.recompute_blueprint_issue_status(v_annotation_id);
  end loop;
  return new;
end;
$$;

revoke all on function public.sync_blueprint_issue_from_operational_record() from public, anon, authenticated;

create or replace function public.sync_operational_records_from_blueprint_issue()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.annotation_type <> 'pin' or new.status is not distinct from old.status then return new; end if;

  if new.status = 'resolved' then
    update public.tasks set status = 'completed', completion_percentage = 100,
      actual_finish = coalesce(actual_finish, current_date), updated_at = now()
      where company_id = new.company_id and status not in ('completed', 'cancelled') and id in (
        select target_id from public.blueprint_operational_links where company_id = new.company_id and annotation_id = new.id and target_type = 'task'
      );
    update public.project_punch_items set status = 'completed', completed_at = coalesce(completed_at, now()), updated_by = auth.uid(), updated_at = now()
      where company_id = new.company_id and status not in ('completed', 'cancelled') and id in (
        select target_id from public.blueprint_operational_links where company_id = new.company_id and annotation_id = new.id and target_type = 'punch_item'
      );
    update public.workforce_assignments set status = 'completed', updated_at = now()
      where company_id = new.company_id and status not in ('completed', 'cancelled') and id in (
        select target_id from public.blueprint_operational_links where company_id = new.company_id and annotation_id = new.id and target_type = 'workforce_assignment'
      );
  else
    update public.tasks set status = 'in_progress', completion_percentage = least(completion_percentage, 99), actual_finish = null, updated_at = now()
      where company_id = new.company_id and status = 'completed' and id in (
        select target_id from public.blueprint_operational_links where company_id = new.company_id and annotation_id = new.id and target_type = 'task'
      );
    update public.project_punch_items set status = 'reopened', completed_at = null, reopened_at = now(), updated_by = auth.uid(), updated_at = now()
      where company_id = new.company_id and status = 'completed' and id in (
        select target_id from public.blueprint_operational_links where company_id = new.company_id and annotation_id = new.id and target_type = 'punch_item'
      );
    update public.workforce_assignments set status = 'in_progress', updated_at = now()
      where company_id = new.company_id and status = 'completed' and id in (
        select target_id from public.blueprint_operational_links where company_id = new.company_id and annotation_id = new.id and target_type = 'workforce_assignment'
      );
  end if;

  insert into public.workflow_events (
    company_id, workflow_name, event_type, current_state, next_state,
    actor_profile_id, reference_entity, reference_id, source_module,
    payload, metadata, idempotency_key
  ) values (
    new.company_id, 'blueprint_issue_status', 'blueprint.issue_status_changed', old.status, new.status,
    auth.uid(), 'blueprint_annotation', new.id, 'blueprints',
    jsonb_build_object('project_id', new.project_id, 'blueprint_version_id', new.blueprint_version_id, 'annotation_id', new.id),
    jsonb_build_object('project_id', new.project_id, 'synchronization', 'two_way'),
    'blueprint:issue-status:' || new.id::text || ':' || new.status || ':' || extract(epoch from new.updated_at)::text
  ) on conflict (company_id, event_type, idempotency_key) where idempotency_key is not null do nothing;
  return new;
end;
$$;

revoke all on function public.sync_operational_records_from_blueprint_issue() from public, anon, authenticated;

drop trigger if exists trg_blueprint_issue_to_operations on public.blueprint_annotations;
create trigger trg_blueprint_issue_to_operations after update of status on public.blueprint_annotations
for each row execute function public.sync_operational_records_from_blueprint_issue();

drop trigger if exists trg_task_to_blueprint_issue on public.tasks;
create trigger trg_task_to_blueprint_issue after update of status on public.tasks
for each row execute function public.sync_blueprint_issue_from_operational_record('task');
drop trigger if exists trg_punch_to_blueprint_issue on public.project_punch_items;
create trigger trg_punch_to_blueprint_issue after update of status on public.project_punch_items
for each row execute function public.sync_blueprint_issue_from_operational_record('punch_item');
drop trigger if exists trg_workforce_to_blueprint_issue on public.workforce_assignments;
create trigger trg_workforce_to_blueprint_issue after update of status on public.workforce_assignments
for each row execute function public.sync_blueprint_issue_from_operational_record('workforce_assignment');
drop trigger if exists trg_change_order_to_blueprint_issue on public.change_orders;
create trigger trg_change_order_to_blueprint_issue after update of status on public.change_orders
for each row execute function public.sync_blueprint_issue_from_operational_record('change_order');
drop trigger if exists trg_rfi_to_blueprint_issue on public.project_communications;
create trigger trg_rfi_to_blueprint_issue after update of status on public.project_communications
for each row when (new.channel = 'rfi') execute function public.sync_blueprint_issue_from_operational_record('rfi');

commit;

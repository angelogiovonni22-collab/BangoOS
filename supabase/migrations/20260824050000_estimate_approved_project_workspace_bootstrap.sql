create or replace function public.bootstrap_estimate_project_workspace(
  p_company_id uuid,
  p_estimate_id uuid
) returns table(project_id uuid, seeded_phase_count integer, idempotent boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_existing_count integer;
  v_seeded_count integer := 0;
  v_phase_names jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('project-workspace-bootstrap:' || p_estimate_id::text, 0));

  select coalesce(e.converted_project_id, e.project_id)
    into v_project_id
  from public.estimates e
  where e.company_id = p_company_id
    and e.id = p_estimate_id
    and e.status = 'approved';

  if v_project_id is null then
    raise exception 'APPROVED_ESTIMATE_PROJECT_REQUIRED';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.company_id = p_company_id and p.id = v_project_id
  ) then
    raise exception 'ESTIMATE_PROJECT_COMPANY_MISMATCH';
  end if;

  select count(*)::integer
    into v_existing_count
  from public.project_phases ph
  where ph.company_id = p_company_id
    and ph.project_id = v_project_id;

  if v_existing_count = 0 then
    with ranked_sections as (
      select
        btrim(s.name) as name,
        s.sort_order,
        row_number() over (
          partition by lower(btrim(s.name))
          order by s.sort_order, s.id
        ) as duplicate_rank
      from public.estimate_sections s
      where s.company_id = p_company_id
        and s.estimate_id = p_estimate_id
        and s.deleted_at is null
        and nullif(btrim(s.name), '') is not null
    )
    insert into public.project_phases(company_id, project_id, name, sort_order)
    select p_company_id, v_project_id, rs.name, rs.sort_order
    from ranked_sections rs
    where rs.duplicate_rank = 1
    order by rs.sort_order, lower(rs.name)
    on conflict on constraint project_phases_project_name_unique do nothing;

    get diagnostics v_seeded_count = row_count;

    if v_seeded_count = 0 then
      insert into public.project_phases(company_id, project_id, name, sort_order)
      values
        (p_company_id, v_project_id, 'Pre-Construction', 100),
        (p_company_id, v_project_id, 'Execution', 200),
        (p_company_id, v_project_id, 'Closeout', 300)
      on conflict on constraint project_phases_project_name_unique do nothing;

      get diagnostics v_seeded_count = row_count;
    end if;
  end if;

  select coalesce(jsonb_agg(ph.name order by ph.sort_order, lower(ph.name)), '[]'::jsonb)
    into v_phase_names
  from public.project_phases ph
  where ph.company_id = p_company_id
    and ph.project_id = v_project_id;

  insert into public.workflow_events(
    company_id, workflow_name, event_type, current_state, next_state,
    actor_profile_id, reference_entity, reference_id, source_module,
    payload, metadata, idempotency_key
  ) values (
    p_company_id, 'project_lifecycle', 'project.workspace_bootstrapped', null, 'ready',
    null, 'project', v_project_id, 'projects',
    jsonb_build_object(
      'project_id', v_project_id,
      'estimate_id', p_estimate_id,
      'seeded_phases', v_phase_names,
      'seeded_phase_count', jsonb_array_length(v_phase_names)
    ),
    jsonb_build_object('source', 'estimate_approved_conversion'),
    'project-workspace-bootstrap:' || p_estimate_id::text
  )
  on conflict (company_id, event_type, idempotency_key)
    where idempotency_key is not null
  do nothing;

  return query
  select v_project_id, jsonb_array_length(v_phase_names), v_existing_count > 0;
end;
$$;

comment on function public.bootstrap_estimate_project_workspace(uuid, uuid) is
  'Idempotently seeds an approved estimate project workspace from ordered estimate sections, or deterministic fallback phases, and records the bootstrap event.';

revoke all on function public.bootstrap_estimate_project_workspace(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_estimate_project_workspace(uuid, uuid) to service_role;

create or replace function public.bootstrap_estimate_project_workspace_from_conversion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and coalesce(new.converted_project_id, new.project_id) is not null then
    perform public.bootstrap_estimate_project_workspace(new.company_id, new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.bootstrap_estimate_project_workspace_from_conversion() from public, anon, authenticated;

drop trigger if exists estimates_bootstrap_project_workspace on public.estimates;
create trigger estimates_bootstrap_project_workspace
after insert or update of status, project_id, converted_project_id
on public.estimates
for each row
when (new.status = 'approved' and coalesce(new.converted_project_id, new.project_id) is not null)
execute function public.bootstrap_estimate_project_workspace_from_conversion();

do $$
declare v_estimate record;
begin
  for v_estimate in
    select e.company_id, e.id
    from public.estimates e
    where e.status = 'approved'
      and coalesce(e.converted_project_id, e.project_id) is not null
    order by e.created_at, e.id
  loop
    perform public.bootstrap_estimate_project_workspace(v_estimate.company_id, v_estimate.id);
  end loop;
end;
$$;

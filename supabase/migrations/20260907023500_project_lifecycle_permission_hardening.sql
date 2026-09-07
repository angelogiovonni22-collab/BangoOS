begin;

-- Project delete/restore are SECURITY DEFINER RPCs. Route visibility is already
-- gated by projects.manage, so enforce the same permission at the database
-- boundary to prevent a projects.view-only member from invoking the RPCs
-- directly. bos_role_has_permission also honors tenant permission overrides.
create or replace function public.soft_delete_project(p_project_id uuid)
returns table(history_id uuid, deleted_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company_id uuid;
  v_status text;
  v_history_id uuid;
  v_deleted_at timestamptz := now();
begin
  select pr.company_id, coalesce(pr.status, 'lead')
    into v_company_id, v_status
  from public.projects pr
  where pr.id = p_project_id;

  if v_company_id is null then
    raise exception 'Project not found.';
  end if;

  if auth.uid() is null
     or not public.bos_role_has_permission(v_company_id, 'projects.manage', auth.uid()) then
    raise exception 'Unauthorized.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.project_deletion_history h
    where h.project_id = p_project_id
      and h.company_id = v_company_id
      and h.restored_at is null
  ) then
    raise exception 'Project is already deleted.';
  end if;

  insert into public.project_deletion_history(
    company_id, project_id, previous_status, deleted_at, deleted_by
  )
  values (v_company_id, p_project_id, v_status, v_deleted_at, auth.uid())
  returning id into v_history_id;

  update public.projects
  set status = 'cancelled', updated_at = v_deleted_at
  where id = p_project_id and company_id = v_company_id;

  return query select v_history_id, v_deleted_at;
end;
$function$;

create or replace function public.restore_deleted_project(p_project_id uuid)
returns table(history_id uuid, restored_status text, restored_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company_id uuid;
  v_history_id uuid;
  v_previous_status text;
  v_restored_at timestamptz := now();
begin
  select pr.company_id
    into v_company_id
  from public.projects pr
  where pr.id = p_project_id;

  if v_company_id is null then
    raise exception 'Project not found.';
  end if;

  if auth.uid() is null
     or not public.bos_role_has_permission(v_company_id, 'projects.manage', auth.uid()) then
    raise exception 'Unauthorized.' using errcode = '42501';
  end if;

  select h.id, h.previous_status
    into v_history_id, v_previous_status
  from public.project_deletion_history h
  where h.project_id = p_project_id
    and h.company_id = v_company_id
    and h.restored_at is null
  order by h.deleted_at desc
  limit 1;

  if v_history_id is null then
    raise exception 'Deleted project history not found.';
  end if;

  update public.projects
  set status = coalesce(nullif(v_previous_status, ''), 'lead'), updated_at = v_restored_at
  where id = p_project_id and company_id = v_company_id;

  update public.project_deletion_history
  set restored_at = v_restored_at, restored_by = auth.uid()
  where id = v_history_id;

  return query
    select v_history_id, coalesce(nullif(v_previous_status, ''), 'lead'), v_restored_at;
end;
$function$;

revoke all on function public.soft_delete_project(uuid) from public, anon;
revoke all on function public.restore_deleted_project(uuid) from public, anon;
grant execute on function public.soft_delete_project(uuid) to authenticated, service_role;
grant execute on function public.restore_deleted_project(uuid) to authenticated, service_role;

commit;

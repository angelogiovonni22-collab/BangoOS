begin;

create table public.blueprint_operational_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  blueprint_version_id uuid not null,
  annotation_id uuid not null references public.blueprint_annotations(id) on delete cascade,
  target_type text not null check (target_type in ('task', 'estimate_line_item', 'change_order', 'rfi', 'punch_item')),
  target_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (blueprint_version_id, company_id, project_id)
    references public.blueprint_versions(id, company_id, project_id) on delete cascade,
  unique (company_id, annotation_id, target_type, target_id)
);

create index blueprint_operational_links_source_idx
  on public.blueprint_operational_links(company_id, project_id, blueprint_version_id, annotation_id);
create index blueprint_operational_links_target_idx
  on public.blueprint_operational_links(company_id, target_type, target_id);

alter table public.blueprint_operational_links enable row level security;
create policy blueprint_operational_links_select on public.blueprint_operational_links
for select to authenticated using (public.is_company_member(company_id));
create policy blueprint_operational_links_insert on public.blueprint_operational_links
for insert to authenticated with check (
  public.is_company_member(company_id)
  and public.blueprint_project_belongs_to_company(project_id, company_id)
  and created_by = auth.uid()
);
create policy blueprint_operational_links_delete on public.blueprint_operational_links
for delete to authenticated
using (public.is_company_member(company_id) and created_by = auth.uid());

create or replace function public.create_task_from_blueprint_issue(
  p_company_id uuid, p_project_id uuid, p_blueprint_version_id uuid, p_annotation_id uuid
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_annotation public.blueprint_annotations%rowtype;
  v_task_id uuid;
  v_task_number integer;
begin
  if auth.uid() is null or not public.is_company_member(p_company_id) then
    raise exception 'Blueprint task creation is not authorized.' using errcode = '42501';
  end if;

  select * into v_annotation from public.blueprint_annotations
  where id = p_annotation_id and company_id = p_company_id
    and project_id = p_project_id and blueprint_version_id = p_blueprint_version_id
    and annotation_type = 'pin';
  if not found then
    raise exception 'Blueprint issue pin was not found.' using errcode = 'P0002';
  end if;

  select target_id into v_task_id from public.blueprint_operational_links
  where company_id = p_company_id and annotation_id = p_annotation_id and target_type = 'task'
  order by created_at limit 1;
  if v_task_id is not null then return v_task_id; end if;

  perform pg_advisory_xact_lock(hashtext(p_project_id::text));
  select coalesce(max(task_number), 0) + 1 into v_task_number from public.tasks
  where company_id = p_company_id and project_id = p_project_id;

  insert into public.tasks (
    company_id, project_id, task_number, title, description, priority, status, created_by
  ) values (
    p_company_id, p_project_id, v_task_number,
    coalesce(nullif(btrim(v_annotation.content), ''), 'Blueprint issue'),
    'Created from Blueprint issue pin ' || p_annotation_id::text || ' on revision ' || p_blueprint_version_id::text || '.',
    'high', 'not_started', auth.uid()
  ) returning id into v_task_id;

  insert into public.blueprint_operational_links (
    company_id, project_id, blueprint_version_id, annotation_id, target_type, target_id, created_by
  ) values (
    p_company_id, p_project_id, p_blueprint_version_id, p_annotation_id, 'task', v_task_id, auth.uid()
  );
  return v_task_id;
end;
$$;

revoke all on function public.create_task_from_blueprint_issue(uuid, uuid, uuid, uuid) from public;
grant execute on function public.create_task_from_blueprint_issue(uuid, uuid, uuid, uuid) to authenticated;

commit;

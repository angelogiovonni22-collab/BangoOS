begin;

create table if not exists public.project_deletion_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  previous_status text not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid null references public.profiles(id) on delete set null,
  restored_at timestamptz null,
  restored_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_deletion_history_company_active
  on public.project_deletion_history(company_id, deleted_at desc)
  where restored_at is null;

create index if not exists idx_project_deletion_history_project
  on public.project_deletion_history(project_id, deleted_at desc);

alter table public.project_deletion_history enable row level security;

drop policy if exists project_deletion_history_select on public.project_deletion_history;
create policy project_deletion_history_select
on public.project_deletion_history
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_deletion_history.company_id
  )
);

create or replace function public.soft_delete_project(p_project_id uuid)
returns table(history_id uuid, deleted_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
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

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = v_company_id
  ) then
    raise exception 'Unauthorized.';
  end if;

  if exists (
    select 1 from public.project_deletion_history h
    where h.project_id = p_project_id and h.company_id = v_company_id and h.restored_at is null
  ) then
    raise exception 'Project is already deleted.';
  end if;

  insert into public.project_deletion_history(company_id, project_id, previous_status, deleted_at, deleted_by)
  values (v_company_id, p_project_id, v_status, v_deleted_at, auth.uid())
  returning id into v_history_id;

  update public.projects
  set status = 'cancelled', updated_at = v_deleted_at
  where id = p_project_id and company_id = v_company_id;

  return query select v_history_id, v_deleted_at;
end;
$$;

create or replace function public.restore_deleted_project(p_project_id uuid)
returns table(history_id uuid, restored_status text, restored_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
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

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = v_company_id
  ) then
    raise exception 'Unauthorized.';
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

  return query select v_history_id, coalesce(nullif(v_previous_status, ''), 'lead'), v_restored_at;
end;
$$;

grant execute on function public.soft_delete_project(uuid) to authenticated;
grant execute on function public.restore_deleted_project(uuid) to authenticated;

commit;

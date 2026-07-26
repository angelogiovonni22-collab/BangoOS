begin;

-- =====================================================================
-- 1) project_phases
-- =====================================================================
create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_phases_project_name_unique
    unique (project_id, name)
);

create index if not exists idx_project_phases_company_project
  on public.project_phases(company_id, project_id);

create index if not exists idx_project_phases_project_sort_order
  on public.project_phases(project_id, sort_order);

alter table public.project_phases enable row level security;

drop policy if exists project_phases_select on public.project_phases;
drop policy if exists project_phases_insert on public.project_phases;
drop policy if exists project_phases_update on public.project_phases;
drop policy if exists project_phases_delete on public.project_phases;

create policy project_phases_select
on public.project_phases
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_phases.company_id
  )
);

create policy project_phases_insert
on public.project_phases
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_phases.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_phases.project_id
      and pr.company_id = project_phases.company_id
  )
);

create policy project_phases_update
on public.project_phases
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_phases.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_phases.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_phases.project_id
      and pr.company_id = project_phases.company_id
  )
);

create policy project_phases_delete
on public.project_phases
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_phases.company_id
  )
);

-- =====================================================================
-- 2) tasks
-- =====================================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assigned_profile_id uuid null references public.profiles(id) on delete set null,
  phase_id uuid null references public.project_phases(id) on delete set null,
  task_number integer not null,
  title text not null,
  description text null,
  priority text not null default 'medium',
  status text not null default 'not_started',
  planned_start date null,
  planned_finish date null,
  estimated_completion_date date null,
  actual_start date null,
  actual_finish date null,
  estimated_hours numeric(8,2) null,
  actual_hours numeric(8,2) null,
  completion_percentage integer not null default 0,
  sort_order integer not null default 0,
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_project_task_number_unique
    unique (project_id, task_number),

  constraint tasks_priority_check
    check (priority in ('low','medium','high','urgent')),

  constraint tasks_status_check
    check (
      status in (
        'not_started',
        'ready',
        'in_progress',
        'blocked',
        'on_hold',
        'completed',
        'cancelled'
      )
    ),

  constraint tasks_completion_percentage_check
    check (completion_percentage between 0 and 100),

  constraint tasks_estimated_hours_check
    check (estimated_hours is null or estimated_hours >= 0),

  constraint tasks_actual_hours_check
    check (actual_hours is null or actual_hours >= 0),

  constraint tasks_planned_date_order_check
    check (
      planned_finish is null
      or planned_start is null
      or planned_finish >= planned_start
    ),

  constraint tasks_actual_date_order_check
    check (
      actual_finish is null
      or actual_start is null
      or actual_finish >= actual_start
    )
);

create index if not exists idx_tasks_company_created_at
  on public.tasks(company_id, created_at desc);

create index if not exists idx_tasks_company_project
  on public.tasks(company_id, project_id);

create index if not exists idx_tasks_company_status
  on public.tasks(company_id, status);

create index if not exists idx_tasks_company_priority
  on public.tasks(company_id, priority);

create index if not exists idx_tasks_company_assigned_profile
  on public.tasks(company_id, assigned_profile_id);

create index if not exists idx_tasks_company_planned_finish
  on public.tasks(company_id, planned_finish);

create index if not exists idx_tasks_company_phase
  on public.tasks(company_id, phase_id);

create index if not exists idx_tasks_project_task_number
  on public.tasks(project_id, task_number);

create index if not exists idx_tasks_company_estimated_completion_date
  on public.tasks(company_id, estimated_completion_date);

alter table public.tasks enable row level security;

drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;

create policy tasks_select
on public.tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = tasks.company_id
  )
);

create policy tasks_insert
on public.tasks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = tasks.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = tasks.project_id
      and pr.company_id = tasks.company_id
  )
  and (
    tasks.assigned_profile_id is null
    or exists (
      select 1
      from public.profiles ap
      where ap.id = tasks.assigned_profile_id
        and ap.company_id = tasks.company_id
    )
  )
  and (
    tasks.phase_id is null
    or exists (
      select 1
      from public.project_phases ph
      where ph.id = tasks.phase_id
        and ph.project_id = tasks.project_id
        and ph.company_id = tasks.company_id
    )
  )
);

create policy tasks_update
on public.tasks
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = tasks.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = tasks.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = tasks.project_id
      and pr.company_id = tasks.company_id
  )
  and (
    tasks.assigned_profile_id is null
    or exists (
      select 1
      from public.profiles ap
      where ap.id = tasks.assigned_profile_id
        and ap.company_id = tasks.company_id
    )
  )
  and (
    tasks.phase_id is null
    or exists (
      select 1
      from public.project_phases ph
      where ph.id = tasks.phase_id
        and ph.project_id = tasks.project_id
        and ph.company_id = tasks.company_id
    )
  )
);

create policy tasks_delete
on public.tasks
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = tasks.company_id
  )
);

-- =====================================================================
-- 3) task_dependencies
-- =====================================================================
create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start',
  created_at timestamptz not null default now(),

  constraint task_dependencies_not_self_check
    check (task_id <> depends_on_task_id),

  constraint task_dependencies_type_check
    check (
      dependency_type in (
        'finish_to_start',
        'start_to_start',
        'finish_to_finish',
        'start_to_finish'
      )
    ),

  constraint task_dependencies_unique_pair
    unique (task_id, depends_on_task_id)
);

create index if not exists idx_task_dependencies_task_id
  on public.task_dependencies(task_id);

create index if not exists idx_task_dependencies_depends_on_task_id
  on public.task_dependencies(depends_on_task_id);

alter table public.task_dependencies enable row level security;

drop policy if exists task_dependencies_select on public.task_dependencies;
drop policy if exists task_dependencies_insert on public.task_dependencies;
drop policy if exists task_dependencies_update on public.task_dependencies;
drop policy if exists task_dependencies_delete on public.task_dependencies;

create policy task_dependencies_select
on public.task_dependencies
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = task_dependencies.company_id
  )
  and exists (
    select 1
    from public.tasks t1
    where t1.id = task_dependencies.task_id
      and t1.company_id = task_dependencies.company_id
  )
  and exists (
    select 1
    from public.tasks t2
    where t2.id = task_dependencies.depends_on_task_id
      and t2.company_id = task_dependencies.company_id
  )
);

create policy task_dependencies_insert
on public.task_dependencies
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = task_dependencies.company_id
  )
  and exists (
    select 1
    from public.tasks t1
    where t1.id = task_dependencies.task_id
      and t1.company_id = task_dependencies.company_id
  )
  and exists (
    select 1
    from public.tasks t2
    where t2.id = task_dependencies.depends_on_task_id
      and t2.company_id = task_dependencies.company_id
  )
);

create policy task_dependencies_update
on public.task_dependencies
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = task_dependencies.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = task_dependencies.company_id
  )
  and exists (
    select 1
    from public.tasks t1
    where t1.id = task_dependencies.task_id
      and t1.company_id = task_dependencies.company_id
  )
  and exists (
    select 1
    from public.tasks t2
    where t2.id = task_dependencies.depends_on_task_id
      and t2.company_id = task_dependencies.company_id
  )
);

create policy task_dependencies_delete
on public.task_dependencies
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = task_dependencies.company_id
  )
);

-- =====================================================================
-- 4) Reuse existing updated_at trigger function pattern
--    Attach to project_phases and tasks only.
--    If no reusable function is found, abort safely.
-- =====================================================================
do $$
declare
  v_fn regprocedure;
begin
  select p.oid::regprocedure
    into v_fn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_attribute a
    on a.attrelid = c.oid
   and a.attname = 'updated_at'
  where n.nspname = 'public'
    and c.relname in ('companies','customers','profiles','projects','estimates','invoices')
    and not t.tgisinternal
  order by c.relname, t.tgname
  limit 1;

  if v_fn is null then
    raise exception
      'No existing updated_at trigger function found to reuse. Migration aborted to avoid creating duplicate function.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'project_phases'
      and t.tgname = 'trg_project_phases_set_updated_at'
  ) then
    execute format(
      'create trigger trg_project_phases_set_updated_at before update on public.project_phases for each row execute function %s;',
      v_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'tasks'
      and t.tgname = 'trg_tasks_set_updated_at'
  ) then
    execute format(
      'create trigger trg_tasks_set_updated_at before update on public.tasks for each row execute function %s;',
      v_fn
    );
  end if;
end $$;

commit;

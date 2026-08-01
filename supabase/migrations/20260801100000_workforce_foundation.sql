begin;

-- Ensure parent tables expose the composite keys needed for company-scoped workforce relationships.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_id_company_unique'
  ) then
    alter table public.profiles
      add constraint profiles_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_id_company_unique'
  ) then
    alter table public.projects
      add constraint projects_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_phases_id_company_unique'
  ) then
    alter table public.project_phases
      add constraint project_phases_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_phases_id_project_company_unique'
  ) then
    alter table public.project_phases
      add constraint project_phases_id_project_company_unique unique (id, project_id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_id_company_unique'
  ) then
    alter table public.tasks
      add constraint tasks_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_id_project_company_unique'
  ) then
    alter table public.tasks
      add constraint tasks_id_project_company_unique unique (id, project_id, company_id);
  end if;
end $$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid null,
  employee_number text not null,
  employment_status text not null default 'active',
  position_title text not null,
  trade text null,
  supervisor_profile_id uuid null,
  primary_crew_id uuid null,
  hire_date date not null,
  termination_date date null,
  availability_status text not null default 'unknown',
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint employees_employee_number_not_blank_check check (btrim(employee_number) <> ''),
  constraint employees_position_title_not_blank_check check (btrim(position_title) <> ''),
  constraint employees_employment_status_check check (
    employment_status in ('active', 'inactive', 'leave', 'terminated')
  ),
  constraint employees_availability_status_check check (
    availability_status in ('available', 'assigned', 'unavailable', 'restricted', 'unknown')
  ),
  constraint employees_termination_date_check check (
    (employment_status = 'terminated' and termination_date is not null)
    or (employment_status <> 'terminated' and termination_date is null)
  )
);

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  crew_code text not null,
  name text not null,
  description text null,
  status text not null default 'active',
  lead_profile_id uuid null,
  supervisor_profile_id uuid null,
  home_location text null,
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crews_crew_code_not_blank_check check (btrim(crew_code) <> ''),
  constraint crews_name_not_blank_check check (btrim(name) <> ''),
  constraint crews_status_check check (status in ('active', 'inactive', 'archived'))
);

create table if not exists public.crew_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  crew_id uuid not null,
  employee_id uuid not null,
  role text not null,
  is_primary boolean not null default false,
  starts_on date not null,
  ends_on date null,
  status text not null default 'planned',
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crew_memberships_role_not_blank_check check (btrim(role) <> ''),
  constraint crew_memberships_status_check check (status in ('active', 'ended', 'planned')),
  constraint crew_memberships_date_order_check check (ends_on is null or ends_on >= starts_on),
  constraint crew_memberships_ended_requires_end_date_check check (status <> 'ended' or ends_on is not null)
);

create table if not exists public.workforce_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  assignment_type text not null,
  crew_id uuid null,
  employee_id uuid null,
  project_id uuid not null,
  phase_id uuid null,
  task_id uuid null,
  title text not null,
  description text null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  planned_hours numeric(10,2) not null default 0,
  status text not null default 'planned',
  source_type text not null default 'manual',
  source_id text null,
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workforce_assignments_assignment_type_check check (assignment_type in ('crew', 'employee')),
  constraint workforce_assignments_status_check check (
    status in ('planned', 'confirmed', 'in_progress', 'completed', 'cancelled')
  ),
  constraint workforce_assignments_source_type_check check (
    source_type in ('manual', 'schedule', 'task', 'project', 'import')
  ),
  constraint workforce_assignments_title_not_blank_check check (btrim(title) <> ''),
  constraint workforce_assignments_planned_hours_check check (planned_hours >= 0),
  constraint workforce_assignments_time_order_check check (ends_at > starts_at),
  constraint workforce_assignments_type_reference_check check (
    (assignment_type = 'crew' and crew_id is not null and employee_id is null)
    or (assignment_type = 'employee' and employee_id is not null and crew_id is null)
  ),
  constraint workforce_assignments_source_reference_check check (
    source_type = 'manual'
    or btrim(coalesce(source_id, '')) <> ''
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_id_company_unique'
  ) then
    alter table public.employees
      add constraint employees_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_company_id_employee_number_unique'
  ) then
    alter table public.employees
      add constraint employees_company_id_employee_number_unique unique (company_id, employee_number);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'crews_id_company_unique'
  ) then
    alter table public.crews
      add constraint crews_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'crews_company_id_crew_code_unique'
  ) then
    alter table public.crews
      add constraint crews_company_id_crew_code_unique unique (company_id, crew_code);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'crew_memberships_id_company_unique'
  ) then
    alter table public.crew_memberships
      add constraint crew_memberships_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'workforce_assignments_id_company_unique'
  ) then
    alter table public.workforce_assignments
      add constraint workforce_assignments_id_company_unique unique (id, company_id);
  end if;
end $$;

alter table public.employees
  drop constraint if exists employees_profile_company_fkey,
  add constraint employees_profile_company_fkey
    foreign key (profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.employees
  drop constraint if exists employees_supervisor_profile_company_fkey,
  add constraint employees_supervisor_profile_company_fkey
    foreign key (supervisor_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.employees
  drop constraint if exists employees_primary_crew_company_fkey,
  add constraint employees_primary_crew_company_fkey
    foreign key (primary_crew_id, company_id)
    references public.crews(id, company_id)
    on delete set null;

alter table public.employees
  drop constraint if exists employees_created_by_company_fkey,
  add constraint employees_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.employees
  drop constraint if exists employees_updated_by_company_fkey,
  add constraint employees_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.crews
  drop constraint if exists crews_lead_profile_company_fkey,
  add constraint crews_lead_profile_company_fkey
    foreign key (lead_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.crews
  drop constraint if exists crews_supervisor_profile_company_fkey,
  add constraint crews_supervisor_profile_company_fkey
    foreign key (supervisor_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.crews
  drop constraint if exists crews_created_by_company_fkey,
  add constraint crews_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.crews
  drop constraint if exists crews_updated_by_company_fkey,
  add constraint crews_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.crew_memberships
  drop constraint if exists crew_memberships_crew_company_fkey,
  add constraint crew_memberships_crew_company_fkey
    foreign key (crew_id, company_id)
    references public.crews(id, company_id)
    on delete cascade;

alter table public.crew_memberships
  drop constraint if exists crew_memberships_employee_company_fkey,
  add constraint crew_memberships_employee_company_fkey
    foreign key (employee_id, company_id)
    references public.employees(id, company_id)
    on delete cascade;

alter table public.crew_memberships
  drop constraint if exists crew_memberships_created_by_company_fkey,
  add constraint crew_memberships_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.crew_memberships
  drop constraint if exists crew_memberships_updated_by_company_fkey,
  add constraint crew_memberships_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.workforce_assignments
  drop constraint if exists workforce_assignments_crew_company_fkey,
  add constraint workforce_assignments_crew_company_fkey
    foreign key (crew_id, company_id)
    references public.crews(id, company_id)
    on delete set null;

alter table public.workforce_assignments
  drop constraint if exists workforce_assignments_employee_company_fkey,
  add constraint workforce_assignments_employee_company_fkey
    foreign key (employee_id, company_id)
    references public.employees(id, company_id)
    on delete set null;

alter table public.workforce_assignments
  drop constraint if exists workforce_assignments_project_company_fkey,
  add constraint workforce_assignments_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.workforce_assignments
  drop constraint if exists workforce_assignments_phase_project_company_fkey,
  add constraint workforce_assignments_phase_project_company_fkey
    foreign key (phase_id, project_id, company_id)
    references public.project_phases(id, project_id, company_id)
    on delete set null;

alter table public.workforce_assignments
  drop constraint if exists workforce_assignments_task_project_company_fkey,
  add constraint workforce_assignments_task_project_company_fkey
    foreign key (task_id, project_id, company_id)
    references public.tasks(id, project_id, company_id)
    on delete set null;

alter table public.workforce_assignments
  drop constraint if exists workforce_assignments_created_by_company_fkey,
  add constraint workforce_assignments_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.workforce_assignments
  drop constraint if exists workforce_assignments_updated_by_company_fkey,
  add constraint workforce_assignments_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create index if not exists idx_employees_company_id
  on public.employees(company_id);

create index if not exists idx_employees_company_employment_status
  on public.employees(company_id, employment_status);

create index if not exists idx_employees_company_availability_status
  on public.employees(company_id, availability_status);

create index if not exists idx_employees_company_profile_id
  on public.employees(company_id, profile_id);

create index if not exists idx_employees_company_supervisor_profile_id
  on public.employees(company_id, supervisor_profile_id);

create index if not exists idx_employees_company_primary_crew_id
  on public.employees(company_id, primary_crew_id);

create unique index if not exists idx_employees_company_profile_active_unique
  on public.employees(company_id, profile_id)
  where profile_id is not null and employment_status in ('active', 'leave');

create index if not exists idx_crews_company_id
  on public.crews(company_id);

create index if not exists idx_crews_company_status
  on public.crews(company_id, status);

create index if not exists idx_crews_company_crew_code
  on public.crews(company_id, crew_code);

create index if not exists idx_crews_company_lead_profile_id
  on public.crews(company_id, lead_profile_id);

create index if not exists idx_crews_company_supervisor_profile_id
  on public.crews(company_id, supervisor_profile_id);

create index if not exists idx_crew_memberships_company_id
  on public.crew_memberships(company_id);

create index if not exists idx_crew_memberships_company_crew_id
  on public.crew_memberships(company_id, crew_id);

create index if not exists idx_crew_memberships_company_employee_id
  on public.crew_memberships(company_id, employee_id);

create index if not exists idx_crew_memberships_company_status
  on public.crew_memberships(company_id, status);

create index if not exists idx_crew_memberships_company_starts_on
  on public.crew_memberships(company_id, starts_on);

create index if not exists idx_crew_memberships_company_ends_on
  on public.crew_memberships(company_id, ends_on);

create unique index if not exists idx_crew_memberships_company_employee_primary_active_unique
  on public.crew_memberships(company_id, employee_id)
  where is_primary = true and status = 'active';

create unique index if not exists idx_crew_memberships_company_employee_crew_active_unique
  on public.crew_memberships(company_id, employee_id, crew_id)
  where status = 'active';

create index if not exists idx_workforce_assignments_company_id
  on public.workforce_assignments(company_id);

create index if not exists idx_workforce_assignments_company_starts_at
  on public.workforce_assignments(company_id, starts_at desc);

create index if not exists idx_workforce_assignments_company_status
  on public.workforce_assignments(company_id, status);

create index if not exists idx_workforce_assignments_company_crew_id
  on public.workforce_assignments(company_id, crew_id);

create index if not exists idx_workforce_assignments_company_employee_id
  on public.workforce_assignments(company_id, employee_id);

create index if not exists idx_workforce_assignments_company_project_id
  on public.workforce_assignments(company_id, project_id);

create index if not exists idx_workforce_assignments_company_task_id
  on public.workforce_assignments(company_id, task_id);

create index if not exists idx_workforce_assignments_company_source_type
  on public.workforce_assignments(company_id, source_type);

create or replace function public.trg_crew_memberships_validate_fn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_overlap_count integer;
begin
  if btrim(coalesce(new.role, '')) = '' then
    raise exception 'crew_memberships.role cannot be blank';
  end if;

  if new.ends_on is not null and new.ends_on < new.starts_on then
    raise exception 'crew_memberships.ends_on must be greater than or equal to starts_on';
  end if;

  if new.status = 'active' then
    select count(*)
      into v_overlap_count
    from public.crew_memberships cm
    where cm.company_id = new.company_id
      and cm.employee_id = new.employee_id
      and cm.crew_id = new.crew_id
      and cm.status = 'active'
      and cm.id <> coalesce(new.id, cm.id)
      and daterange(cm.starts_on, coalesce(cm.ends_on, 'infinity'::date), '[]')
          && daterange(new.starts_on, coalesce(new.ends_on, 'infinity'::date), '[]');

    if v_overlap_count > 0 then
      raise exception 'overlapping active crew membership detected';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_crew_memberships_validate
  on public.crew_memberships;

create trigger trg_crew_memberships_validate
before insert or update on public.crew_memberships
for each row execute function public.trg_crew_memberships_validate_fn();

alter table public.employees enable row level security;
alter table public.crews enable row level security;
alter table public.crew_memberships enable row level security;
alter table public.workforce_assignments enable row level security;

drop policy if exists employees_select on public.employees;
drop policy if exists employees_insert on public.employees;
drop policy if exists employees_update on public.employees;

create policy employees_select
on public.employees
for select
to authenticated
using (
  public.is_company_member(employees.company_id)
);

create policy employees_insert
on public.employees
for insert
to authenticated
with check (
  public.has_company_role(
    employees.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (employees.created_by is null or employees.created_by = auth.uid())
  and (employees.updated_by is null or employees.updated_by = auth.uid())
);

create policy employees_update
on public.employees
for update
to authenticated
using (
  public.has_company_role(
    employees.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
)
with check (
  public.has_company_role(
    employees.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (employees.updated_by is null or employees.updated_by = auth.uid())
);

drop policy if exists crews_select on public.crews;
drop policy if exists crews_insert on public.crews;
drop policy if exists crews_update on public.crews;

create policy crews_select
on public.crews
for select
to authenticated
using (
  public.is_company_member(crews.company_id)
);

create policy crews_insert
on public.crews
for insert
to authenticated
with check (
  public.has_company_role(
    crews.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (crews.created_by is null or crews.created_by = auth.uid())
  and (crews.updated_by is null or crews.updated_by = auth.uid())
);

create policy crews_update
on public.crews
for update
to authenticated
using (
  public.has_company_role(
    crews.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
)
with check (
  public.has_company_role(
    crews.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (crews.updated_by is null or crews.updated_by = auth.uid())
);

drop policy if exists crew_memberships_select on public.crew_memberships;
drop policy if exists crew_memberships_insert on public.crew_memberships;
drop policy if exists crew_memberships_update on public.crew_memberships;

create policy crew_memberships_select
on public.crew_memberships
for select
to authenticated
using (
  public.is_company_member(crew_memberships.company_id)
);

create policy crew_memberships_insert
on public.crew_memberships
for insert
to authenticated
with check (
  public.has_company_role(
    crew_memberships.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (crew_memberships.created_by is null or crew_memberships.created_by = auth.uid())
  and (crew_memberships.updated_by is null or crew_memberships.updated_by = auth.uid())
);

create policy crew_memberships_update
on public.crew_memberships
for update
to authenticated
using (
  public.has_company_role(
    crew_memberships.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
)
with check (
  public.has_company_role(
    crew_memberships.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (crew_memberships.updated_by is null or crew_memberships.updated_by = auth.uid())
);

drop policy if exists workforce_assignments_select on public.workforce_assignments;
drop policy if exists workforce_assignments_insert on public.workforce_assignments;
drop policy if exists workforce_assignments_update on public.workforce_assignments;

create policy workforce_assignments_select
on public.workforce_assignments
for select
to authenticated
using (
  public.is_company_member(workforce_assignments.company_id)
);

create policy workforce_assignments_insert
on public.workforce_assignments
for insert
to authenticated
with check (
  public.has_company_role(
    workforce_assignments.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (workforce_assignments.created_by is null or workforce_assignments.created_by = auth.uid())
  and (workforce_assignments.updated_by is null or workforce_assignments.updated_by = auth.uid())
);

create policy workforce_assignments_update
on public.workforce_assignments
for update
to authenticated
using (
  public.has_company_role(
    workforce_assignments.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
)
with check (
  public.has_company_role(
    workforce_assignments.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (workforce_assignments.updated_by is null or workforce_assignments.updated_by = auth.uid())
);

do $$
declare
  v_updated_at_fn regprocedure;
begin
  select p.oid::regprocedure
    into v_updated_at_fn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_attribute a
    on a.attrelid = c.oid
   and a.attname = 'updated_at'
  where n.nspname = 'public'
    and c.relname in (
      'companies',
      'customers',
      'profiles',
      'projects',
      'estimates',
      'invoices',
      'project_phases',
      'tasks',
      'employees',
      'crews',
      'crew_memberships',
      'workforce_assignments'
    )
    and not t.tgisinternal
  order by c.relname, t.tgname
  limit 1;

  if v_updated_at_fn is null then
    raise exception 'No updated_at trigger function found to reuse.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'employees'
      and t.tgname = 'trg_employees_set_updated_at'
  ) then
    execute format(
      'create trigger trg_employees_set_updated_at before update on public.employees for each row execute function %s;',
      v_updated_at_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'crews'
      and t.tgname = 'trg_crews_set_updated_at'
  ) then
    execute format(
      'create trigger trg_crews_set_updated_at before update on public.crews for each row execute function %s;',
      v_updated_at_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'crew_memberships'
      and t.tgname = 'trg_crew_memberships_set_updated_at'
  ) then
    execute format(
      'create trigger trg_crew_memberships_set_updated_at before update on public.crew_memberships for each row execute function %s;',
      v_updated_at_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'workforce_assignments'
      and t.tgname = 'trg_workforce_assignments_set_updated_at'
  ) then
    execute format(
      'create trigger trg_workforce_assignments_set_updated_at before update on public.workforce_assignments for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;
begin;

-- Ensure parent tables expose (id, company_id) for company-scoped foreign keys.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_id_company_unique'
  ) then
    alter table public.tasks
      add constraint tasks_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'project_phases_id_company_unique'
  ) then
    alter table public.project_phases
      add constraint project_phases_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'projects_id_company_unique'
  ) then
    alter table public.projects
      add constraint projects_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'customers_id_company_unique'
  ) then
    alter table public.customers
      add constraint customers_id_company_unique unique (id, company_id);
  end if;
end $$;

create table if not exists public.bango_memories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  scope text not null,
  category text not null,
  project_id uuid null,
  customer_id uuid null,
  user_id uuid null,
  task_id uuid null,
  phase_id uuid null,
  title text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  importance text not null,
  confidence text not null,
  status text not null default 'active',
  tags text[] not null default '{}',
  source_references jsonb not null default '[]'::jsonb,
  recommendation_status text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  verified_by uuid null references public.profiles(id) on delete set null,
  verified_at timestamptz null,
  expires_at timestamptz null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bango_memories_scope_check
    check (scope in ('global', 'company', 'project', 'customer', 'user', 'task', 'phase')),

  constraint bango_memories_category_check
    check (
      category in (
        'preference',
        'decision',
        'recommendation',
        'outcome',
        'lesson_learned',
        'operational_pattern',
        'customer_preference',
        'vendor_preference',
        'crew_performance',
        'safety_observation',
        'financial_insight',
        'project_milestone',
        'document_summary'
      )
    ),

  constraint bango_memories_importance_check
    check (importance in ('critical', 'high', 'medium', 'low')),

  constraint bango_memories_confidence_check
    check (confidence in ('verified', 'observed', 'inferred', 'draft')),

  constraint bango_memories_status_check
    check (status in ('active', 'archived', 'expired')),

  constraint bango_memories_recommendation_status_check
    check (recommendation_status is null or recommendation_status in ('accepted', 'rejected', 'ignored', 'expired', 'implemented')),

  constraint bango_memories_title_not_blank_check
    check (btrim(title) <> ''),

  constraint bango_memories_summary_not_blank_check
    check (btrim(summary) <> ''),

  constraint bango_memories_scope_integrity_check
    check (
      (scope <> 'project' or project_id is not null)
      and (scope <> 'customer' or customer_id is not null)
      and (scope <> 'user' or user_id is not null)
      and (scope <> 'task' or task_id is not null)
      and (scope <> 'phase' or phase_id is not null)
    ),

  constraint bango_memories_recommendation_category_check
    check (recommendation_status is null or category = 'recommendation')
);

alter table public.bango_memories
  drop constraint if exists bango_memories_project_company_fkey,
  add constraint bango_memories_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete restrict;

alter table public.bango_memories
  drop constraint if exists bango_memories_customer_company_fkey,
  add constraint bango_memories_customer_company_fkey
    foreign key (customer_id, company_id)
    references public.customers(id, company_id)
    on delete restrict;

alter table public.bango_memories
  drop constraint if exists bango_memories_task_company_fkey,
  add constraint bango_memories_task_company_fkey
    foreign key (task_id, company_id)
    references public.tasks(id, company_id)
    on delete restrict;

alter table public.bango_memories
  drop constraint if exists bango_memories_phase_company_fkey,
  add constraint bango_memories_phase_company_fkey
    foreign key (phase_id, company_id)
    references public.project_phases(id, company_id)
    on delete restrict;

create index if not exists idx_bango_memories_company_id
  on public.bango_memories(company_id);

create index if not exists idx_bango_memories_company_scope
  on public.bango_memories(company_id, scope);

create index if not exists idx_bango_memories_company_category
  on public.bango_memories(company_id, category);

create index if not exists idx_bango_memories_company_project
  on public.bango_memories(company_id, project_id);

create index if not exists idx_bango_memories_company_customer
  on public.bango_memories(company_id, customer_id);

create index if not exists idx_bango_memories_company_user
  on public.bango_memories(company_id, user_id);

create index if not exists idx_bango_memories_company_status
  on public.bango_memories(company_id, status);

create index if not exists idx_bango_memories_company_importance
  on public.bango_memories(company_id, importance);

create index if not exists idx_bango_memories_created_at
  on public.bango_memories(created_at desc);

create index if not exists idx_bango_memories_expires_at
  on public.bango_memories(expires_at);

create index if not exists idx_bango_memories_tags_gin
  on public.bango_memories using gin (tags);

create or replace function public.bango_memory_has_active_membership(target_company_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.user_id = auth.uid()
      and cm.company_id = target_company_id
      and cm.status = 'active'
  )
$$;

create or replace function public.bango_memory_membership_role(target_company_id uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select cm.role
  from public.company_memberships cm
  where cm.user_id = auth.uid()
    and cm.company_id = target_company_id
    and cm.status = 'active'
  order by cm.is_primary desc, cm.created_at asc
  limit 1
$$;

create or replace function public.bango_memory_can_read(
  target_company_id uuid,
  memory_category text,
  memory_tags text[]
)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_tags text[] := coalesce(memory_tags, '{}'::text[]);
begin
  if not public.bango_memory_has_active_membership(target_company_id) then
    return false;
  end if;

  v_role := coalesce(public.bango_memory_membership_role(target_company_id), 'employee');

  if memory_category = 'financial_insight'
     and v_role not in ('owner', 'administrator', 'operations_manager', 'accountant') then
    return false;
  end if;

  if (
    'private_payroll' = any(v_tags)
    or 'disciplinary' = any(v_tags)
    or 'restricted_hr' = any(v_tags)
  ) and v_role not in ('owner', 'administrator', 'hr_assistant') then
    return false;
  end if;

  if (
    'restricted_legal' = any(v_tags)
    or 'confidential_document' = any(v_tags)
  ) and v_role not in ('owner', 'administrator', 'operations_manager') then
    return false;
  end if;

  if 'sensitive_safety_investigation' = any(v_tags)
     and v_role not in ('owner', 'administrator', 'operations_manager') then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.bango_memory_can_write(
  target_company_id uuid,
  memory_category text
)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if not public.bango_memory_has_active_membership(target_company_id) then
    return false;
  end if;

  v_role := coalesce(public.bango_memory_membership_role(target_company_id), 'employee');

  if v_role not in (
    'owner',
    'administrator',
    'operations_manager',
    'project_manager',
    'superintendent',
    'estimator',
    'foreman',
    'office_manager',
    'accountant'
  ) then
    return false;
  end if;

  if memory_category = 'financial_insight'
     and v_role not in ('owner', 'administrator', 'operations_manager', 'accountant') then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.bango_memories_integrity_trigger_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_task_project_id uuid;
  v_phase_project_id uuid;
  v_profile_company_id uuid;
begin
  if new.task_id is not null then
    select t.project_id into v_task_project_id
    from public.tasks t
    where t.id = new.task_id
      and t.company_id = new.company_id;

    if v_task_project_id is null then
      raise exception 'task_id must reference a task in the same company';
    end if;

    if new.project_id is not null and new.project_id <> v_task_project_id then
      raise exception 'task_id project must match project_id when both are set';
    end if;
  end if;

  if new.phase_id is not null then
    select ph.project_id into v_phase_project_id
    from public.project_phases ph
    where ph.id = new.phase_id
      and ph.company_id = new.company_id;

    if v_phase_project_id is null then
      raise exception 'phase_id must reference a phase in the same company';
    end if;

    if new.project_id is not null and new.project_id <> v_phase_project_id then
      raise exception 'phase_id project must match project_id when both are set';
    end if;
  end if;

  if new.created_by is not null then
    select p.company_id into v_profile_company_id
    from public.profiles p
    where p.id = new.created_by;

    if v_profile_company_id is distinct from new.company_id then
      raise exception 'created_by profile must belong to memory company';
    end if;
  end if;

  if new.updated_by is not null then
    select p.company_id into v_profile_company_id
    from public.profiles p
    where p.id = new.updated_by;

    if v_profile_company_id is distinct from new.company_id then
      raise exception 'updated_by profile must belong to memory company';
    end if;
  end if;

  if new.verified_by is not null then
    select p.company_id into v_profile_company_id
    from public.profiles p
    where p.id = new.verified_by;

    if v_profile_company_id is distinct from new.company_id then
      raise exception 'verified_by profile must belong to memory company';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bango_memories_integrity on public.bango_memories;
create trigger trg_bango_memories_integrity
before insert or update on public.bango_memories
for each row
execute function public.bango_memories_integrity_trigger_fn();

-- Reuse existing updated_at trigger function from established tables.
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
  where n.nspname = 'public'
    and c.relname in ('companies', 'customers', 'projects', 'tasks', 'invoices', 'estimates')
    and not t.tgisinternal
  order by c.relname, t.tgname
  limit 1;

  if v_fn is null then
    raise exception 'No reusable updated_at trigger function found.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'bango_memories'
      and t.tgname = 'trg_bango_memories_set_updated_at'
  ) then
    execute format(
      'create trigger trg_bango_memories_set_updated_at before update on public.bango_memories for each row execute function %s;',
      v_fn
    );
  end if;
end $$;

alter table public.bango_memories enable row level security;

drop policy if exists bango_memories_select on public.bango_memories;
drop policy if exists bango_memories_insert on public.bango_memories;
drop policy if exists bango_memories_update on public.bango_memories;
drop policy if exists bango_memories_delete on public.bango_memories;

create policy bango_memories_select
on public.bango_memories
for select
to authenticated
using (
  public.bango_memory_has_active_membership(bango_memories.company_id)
  and public.bango_memory_can_read(bango_memories.company_id, bango_memories.category, bango_memories.tags)
);

create policy bango_memories_insert
on public.bango_memories
for insert
to authenticated
with check (
  public.bango_memory_has_active_membership(bango_memories.company_id)
  and public.bango_memory_can_write(bango_memories.company_id, bango_memories.category)
  and public.bango_memory_can_read(bango_memories.company_id, bango_memories.category, bango_memories.tags)
);

create policy bango_memories_update
on public.bango_memories
for update
to authenticated
using (
  public.bango_memory_has_active_membership(bango_memories.company_id)
  and public.bango_memory_can_read(bango_memories.company_id, bango_memories.category, bango_memories.tags)
)
with check (
  public.bango_memory_has_active_membership(bango_memories.company_id)
  and public.bango_memory_can_write(bango_memories.company_id, bango_memories.category)
  and public.bango_memory_can_read(bango_memories.company_id, bango_memories.category, bango_memories.tags)
);

-- No delete policy by design; archival updates are preferred.

commit;

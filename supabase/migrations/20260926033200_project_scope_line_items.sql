begin;

create table if not exists public.project_scope_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  estimate_id uuid null,
  sort_order integer not null default 0,
  category text not null,
  scope_details text not null default '',
  material_cost numeric(14,2) not null default 0,
  labor_cost numeric(14,2) not null default 0,
  status text not null default 'planned',
  color text null,
  source_type text not null default 'project',
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_scope_items_category_not_blank check (btrim(category) <> ''),
  constraint project_scope_items_costs_non_negative check (material_cost >= 0 and labor_cost >= 0),
  constraint project_scope_items_status_check check (status in ('planned','ordered','in_progress','complete','on_hold')),
  constraint project_scope_items_source_check check (source_type in ('project','estimate_allocation','manual')),
  constraint project_scope_items_project_company_fkey foreign key (project_id, company_id)
    references public.projects(id, company_id) on delete cascade,
  constraint project_scope_items_estimate_company_fkey foreign key (estimate_id, company_id)
    references public.estimates(id, company_id) on delete set null (estimate_id)
);

create unique index if not exists idx_project_scope_items_project_sort
  on public.project_scope_items(project_id, sort_order, id);
create index if not exists idx_project_scope_items_company_project
  on public.project_scope_items(company_id, project_id);
create index if not exists idx_project_scope_items_estimate
  on public.project_scope_items(estimate_id, company_id)
  where estimate_id is not null;

alter table public.project_scope_items enable row level security;

create policy project_scope_items_select on public.project_scope_items
  for select to authenticated
  using (public.is_company_member(company_id));

create policy project_scope_items_insert on public.project_scope_items
  for insert to authenticated
  with check (
    public.has_company_role(
      company_id,
      array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','accountant','estimator']
    )
    and (created_by is null or created_by = (select auth.uid()))
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy project_scope_items_update on public.project_scope_items
  for update to authenticated
  using (
    public.has_company_role(
      company_id,
      array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','accountant','estimator']
    )
  )
  with check (
    public.has_company_role(
      company_id,
      array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','accountant','estimator']
    )
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy project_scope_items_delete on public.project_scope_items
  for delete to authenticated
  using (
    public.has_company_role(
      company_id,
      array['owner','administrator','operations_manager','project_manager','office_manager','estimator']
    )
  );

comment on table public.project_scope_items is
  'Editable project working scope breakdown. Keeps signed/accepted estimate records immutable while allowing project teams to add, edit, reorder, and remove operational scope rows.';

commit;

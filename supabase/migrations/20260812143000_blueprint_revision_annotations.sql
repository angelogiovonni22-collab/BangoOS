begin;

create unique index if not exists blueprint_versions_tenant_identity_idx
  on public.blueprint_versions(id, company_id, project_id);

create table public.blueprint_annotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  blueprint_version_id uuid not null,
  annotation_type text not null check (annotation_type in ('freehand','arrow','text','pin')),
  color text not null default '#ef4444' check (color ~ '^#[0-9a-fA-F]{6}$'),
  geometry jsonb not null check (jsonb_typeof(geometry) = 'object'),
  content text check (content is null or char_length(content) <= 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (blueprint_version_id, company_id, project_id)
    references public.blueprint_versions(id, company_id, project_id) on delete cascade
);

create index blueprint_annotations_revision_idx
  on public.blueprint_annotations(company_id, project_id, blueprint_version_id, created_at);

alter table public.blueprint_annotations enable row level security;

create policy blueprint_annotations_select on public.blueprint_annotations
for select to authenticated
using (public.is_company_member(company_id));

create policy blueprint_annotations_insert on public.blueprint_annotations
for insert to authenticated
with check (
  public.is_company_member(company_id)
  and public.blueprint_project_belongs_to_company(project_id, company_id)
  and created_by = auth.uid()
);

create policy blueprint_annotations_update on public.blueprint_annotations
for update to authenticated
using (public.is_company_member(company_id))
with check (
  public.is_company_member(company_id)
  and public.blueprint_project_belongs_to_company(project_id, company_id)
);

create policy blueprint_annotations_delete on public.blueprint_annotations
for delete to authenticated
using (public.is_company_member(company_id) and created_by = auth.uid());

commit;

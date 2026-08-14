begin;

create table public.blueprint_layers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  discipline text not null check (discipline in ('Architectural','Structural','Civil','Mechanical','Electrical','Plumbing','Fire Protection','Specifications','Permits','Other')),
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (company_id, project_id, discipline, name),
  unique (id, company_id, project_id)
);

alter table public.blueprint_layers enable row level security;
create policy blueprint_layers_select on public.blueprint_layers for select to authenticated using (public.is_company_member(company_id));
create policy blueprint_layers_insert on public.blueprint_layers for insert to authenticated with check (public.is_company_member(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id) and created_by = auth.uid());
create policy blueprint_layers_update on public.blueprint_layers for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id));
create policy blueprint_layers_delete on public.blueprint_layers for delete to authenticated using (public.is_company_member(company_id));

alter table public.blueprint_annotations
  add column discipline text,
  add column layer_id uuid,
  add constraint blueprint_annotations_layer_fk foreign key (layer_id, company_id, project_id) references public.blueprint_layers(id, company_id, project_id) on delete set null;
update public.blueprint_annotations annotation set discipline = sheet.discipline
from public.blueprint_versions version join public.blueprint_sheets sheet on sheet.id = version.blueprint_sheet_id
where version.id = annotation.blueprint_version_id and version.company_id = annotation.company_id and version.project_id = annotation.project_id;
alter table public.blueprint_annotations alter column discipline set default 'Architectural', alter column discipline set not null,
  add constraint blueprint_annotations_discipline_check check (discipline in ('Architectural','Structural','Civil','Mechanical','Electrical','Plumbing','Fire Protection','Specifications','Permits','Other'));
create index blueprint_annotations_layer_idx on public.blueprint_annotations(company_id, project_id, blueprint_version_id, discipline, layer_id);

commit;

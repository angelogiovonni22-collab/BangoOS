begin;

create table if not exists public.blueprint_model_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  generated_model_id uuid not null references public.blueprint_generated_models(id) on delete cascade,
  source_version_id uuid not null references public.blueprint_versions(id) on delete cascade,
  correction_type text not null check (correction_type in ('move_wall','add_wall','remove_wall','classify_wall','update_opening','update_room','set_scale')),
  object_id text,
  payload jsonb not null,
  reconstruction_version text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists blueprint_model_corrections_model_idx
  on public.blueprint_model_corrections(company_id, generated_model_id, created_at, id);

alter table public.blueprint_model_corrections enable row level security;

create policy blueprint_model_corrections_select on public.blueprint_model_corrections
for select to authenticated
using (public.blueprint_member_of_company(company_id));

create policy blueprint_model_corrections_insert on public.blueprint_model_corrections
for insert to authenticated
with check (
  public.blueprint_member_of_company(company_id)
  and public.blueprint_project_belongs_to_company(project_id, company_id)
  and created_by = auth.uid()
  and exists (
    select 1 from public.blueprint_generated_models gm
    where gm.id = generated_model_id
      and gm.company_id = company_id
      and gm.project_id = project_id
      and gm.source_version_id = source_version_id
  )
);

create policy blueprint_model_corrections_delete on public.blueprint_model_corrections
for delete to authenticated
using (
  public.blueprint_member_of_company(company_id)
  and created_by = auth.uid()
);

comment on table public.blueprint_model_corrections is
'Append-only user corrections to the canonical B.O.S. Building Graph. Corrections are replayed during regeneration and preserve human provenance.';

commit;

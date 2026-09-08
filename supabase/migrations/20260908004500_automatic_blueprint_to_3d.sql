begin;

create table if not exists public.blueprint_generated_models (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_version_id uuid not null references public.blueprint_versions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','ready','needs_input','failed')),
  storage_path text unique,
  mime_type text check (mime_type is null or mime_type in ('model/gltf-binary','model/gltf+json')),
  geometry_json jsonb,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  assumptions jsonb not null default '[]'::jsonb,
  generation_model text,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, source_version_id)
);

create index if not exists blueprint_generated_models_project_idx
  on public.blueprint_generated_models(company_id, project_id, status, updated_at desc);

alter table public.blueprint_generated_models enable row level security;

create policy blueprint_generated_models_select on public.blueprint_generated_models
for select to authenticated
using (public.blueprint_member_of_company(company_id));

create policy blueprint_generated_models_insert on public.blueprint_generated_models
for insert to authenticated
with check (
  public.blueprint_member_of_company(company_id)
  and public.blueprint_project_belongs_to_company(project_id, company_id)
  and created_by = auth.uid()
);

create policy blueprint_generated_models_update on public.blueprint_generated_models
for update to authenticated
using (public.blueprint_member_of_company(company_id))
with check (
  public.blueprint_member_of_company(company_id)
  and public.blueprint_project_belongs_to_company(project_id, company_id)
);

create policy blueprint_generated_models_delete on public.blueprint_generated_models
for delete to authenticated
using (public.blueprint_member_of_company(company_id));

create policy blueprints_generated_model_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'blueprints'
  and exists (
    select 1
    from public.blueprint_generated_models generated
    where generated.storage_path = name
      and public.blueprint_member_of_company(generated.company_id)
  )
);

create or replace function public.touch_blueprint_generated_model_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_blueprint_generated_models_updated_at on public.blueprint_generated_models;
create trigger trg_blueprint_generated_models_updated_at
before update on public.blueprint_generated_models
for each row execute function public.touch_blueprint_generated_model_updated_at();

comment on table public.blueprint_generated_models is
'AI-assisted conceptual GLB/GLTF models generated from a source Blueprint revision. Generated geometry must be field-verified before construction use.';

commit;

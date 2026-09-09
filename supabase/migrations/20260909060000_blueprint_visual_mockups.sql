begin;

create table public.blueprint_visual_mockups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_version_id uuid not null,
  source_page integer not null check (source_page > 0),
  generated_model_id uuid references public.blueprint_generated_models(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','processing','ready','needs_review','failed')),
  storage_path text unique,
  mime_type text check (mime_type is null or mime_type in ('image/png','image/jpeg','image/webp')),
  generation_provider text,
  generation_model text,
  prompt_template_version text not null,
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  review_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(review_metadata) = 'object'),
  safety_disclaimer text not null default 'Conceptual AI visualization — verify against the source plans before construction use.'
    check (safety_disclaimer = 'Conceptual AI visualization — verify against the source plans before construction use.'),
  error_message text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_version_id, company_id, project_id)
    references public.blueprint_versions(id, company_id, project_id) on delete cascade,
  check (
    (status in ('ready','needs_review') and storage_path is not null and mime_type is not null and error_message is null)
    or (status in ('queued','processing') and storage_path is null and mime_type is null and error_message is null)
    or (status = 'failed' and storage_path is null and mime_type is null and error_message is not null)
  )
);

create index blueprint_visual_mockups_revision_idx
  on public.blueprint_visual_mockups(company_id, project_id, source_version_id, created_at desc);

alter table public.blueprint_visual_mockups enable row level security;

create policy blueprint_visual_mockups_select on public.blueprint_visual_mockups
for select to authenticated using (public.blueprint_member_of_company(company_id));

create policy blueprint_visual_mockups_insert on public.blueprint_visual_mockups
for insert to authenticated with check (
  public.blueprint_member_of_company(company_id)
  and public.blueprint_project_belongs_to_company(project_id, company_id)
  and created_by = auth.uid()
  and exists (
    select 1 from public.blueprint_versions source
    where source.id = blueprint_visual_mockups.source_version_id
      and source.company_id = blueprint_visual_mockups.company_id
      and source.project_id = blueprint_visual_mockups.project_id
  )
  and (
    generated_model_id is null or exists (
      select 1 from public.blueprint_generated_models model
      where model.id = blueprint_visual_mockups.generated_model_id
        and model.company_id = blueprint_visual_mockups.company_id
        and model.project_id = blueprint_visual_mockups.project_id
        and model.source_version_id = blueprint_visual_mockups.source_version_id
    )
  )
);

create policy blueprint_visual_mockups_update on public.blueprint_visual_mockups
for update to authenticated
using (public.blueprint_member_of_company(company_id))
with check (
  public.blueprint_member_of_company(company_id)
  and public.blueprint_project_belongs_to_company(project_id, company_id)
  and exists (
    select 1 from public.blueprint_versions source
    where source.id = blueprint_visual_mockups.source_version_id
      and source.company_id = blueprint_visual_mockups.company_id
      and source.project_id = blueprint_visual_mockups.project_id
  )
  and (
    generated_model_id is null or exists (
      select 1 from public.blueprint_generated_models model
      where model.id = blueprint_visual_mockups.generated_model_id
        and model.company_id = blueprint_visual_mockups.company_id
        and model.project_id = blueprint_visual_mockups.project_id
        and model.source_version_id = blueprint_visual_mockups.source_version_id
    )
  )
);

create policy blueprint_visual_mockups_delete on public.blueprint_visual_mockups
for delete to authenticated using (public.blueprint_member_of_company(company_id) and created_by = auth.uid());

create or replace function public.touch_blueprint_visual_mockup_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_blueprint_visual_mockups_updated_at
before update on public.blueprint_visual_mockups
for each row execute function public.touch_blueprint_visual_mockup_updated_at();

create or replace function public.protect_blueprint_visual_mockup_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.company_id <> old.company_id or new.project_id <> old.project_id
    or new.source_version_id <> old.source_version_id or new.source_page <> old.source_page
    or new.created_by <> old.created_by or new.prompt_template_version <> old.prompt_template_version then
    raise exception 'Blueprint visual mockup identity is immutable';
  end if;
  return new;
end;
$$;

create trigger trg_protect_blueprint_visual_mockup_identity
before update on public.blueprint_visual_mockups
for each row execute function public.protect_blueprint_visual_mockup_identity();

create or replace function public.blueprint_storage_path_authorized(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1 from public.blueprint_sheets sheet
      where sheet.company_id::text = split_part(object_name, '/', 1)
        and sheet.project_id::text = split_part(object_name, '/', 2)
        and sheet.id::text = split_part(object_name, '/', 3)
        and split_part(object_name, '/', 4) <> ''
        and public.blueprint_member_of_company(sheet.company_id)
    )
    or exists (
      select 1 from public.blueprint_versions version
      where split_part(object_name, '/', 3) in ('generated-3d', 'visual-mockups')
        and version.company_id::text = split_part(object_name, '/', 1)
        and version.project_id::text = split_part(object_name, '/', 2)
        and version.id::text = split_part(object_name, '/', 4)
        and split_part(object_name, '/', 5) <> ''
        and public.blueprint_member_of_company(version.company_id)
    );
$$;

revoke all on function public.blueprint_storage_path_authorized(text) from public, anon;
grant execute on function public.blueprint_storage_path_authorized(text) to authenticated;

create policy blueprints_visual_mockup_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'blueprints'
  and exists (
    select 1 from public.blueprint_visual_mockups mockup
    where mockup.storage_path = name and public.blueprint_member_of_company(mockup.company_id)
  )
);

comment on table public.blueprint_visual_mockups is
'Private conceptual AI presentation images bound to a Blueprint revision and selected source page. They are never dimension-certified or construction-ready.';

commit;

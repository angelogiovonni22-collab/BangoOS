begin;

create table public.blueprint_media_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  blueprint_version_id uuid not null,
  page_number integer not null default 1 check (page_number > 0),
  x double precision not null check (x between 0 and 1),
  y double precision not null check (y between 0 and 1),
  caption text check (caption is null or char_length(caption) <= 1000),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 20971520),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (blueprint_version_id, company_id, project_id)
    references public.blueprint_versions(id, company_id, project_id) on delete cascade
);

create index blueprint_media_revision_page_idx
  on public.blueprint_media_attachments(company_id, project_id, blueprint_version_id, page_number, created_at);

alter table public.blueprint_media_attachments enable row level security;
create policy blueprint_media_select on public.blueprint_media_attachments for select to authenticated
  using (public.is_company_member(company_id));
create policy blueprint_media_insert on public.blueprint_media_attachments for insert to authenticated
  with check (public.is_company_member(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id) and created_by = auth.uid());
create policy blueprint_media_delete on public.blueprint_media_attachments for delete to authenticated
  using (public.is_company_member(company_id) and created_by = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blueprint-media', 'blueprint-media', false, 20971520, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy blueprint_media_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'blueprint-media'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
  and public.blueprint_project_belongs_to_company(((storage.foldername(name))[2])::uuid, ((storage.foldername(name))[1])::uuid)
);
create policy blueprint_media_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'blueprint-media' and exists (
    select 1 from public.blueprint_media_attachments attachment
    where attachment.storage_path = name and public.is_company_member(attachment.company_id)
  )
);
create policy blueprint_media_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'blueprint-media' and exists (
    select 1 from public.blueprint_media_attachments attachment
    where attachment.storage_path = name and attachment.created_by = auth.uid()
  )
);

commit;

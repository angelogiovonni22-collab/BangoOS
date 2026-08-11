begin;

create table public.blueprint_sets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  discipline text not null check (discipline in ('Architectural','Structural','Civil','Mechanical','Electrical','Plumbing','Fire Protection','Specifications','Permits','Other')),
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id, project_id)
);

create table public.blueprint_sheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  blueprint_set_id uuid not null,
  sheet_number text not null check (char_length(btrim(sheet_number)) between 1 and 80),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  discipline text not null check (discipline in ('Architectural','Structural','Civil','Mechanical','Electrical','Plumbing','Fire Protection','Specifications','Permits','Other')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (blueprint_set_id, company_id, project_id)
    references public.blueprint_sets(id, company_id, project_id) on delete cascade,
  unique (id, company_id, project_id),
  unique (blueprint_set_id, sheet_number)
);

create table public.blueprint_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  blueprint_sheet_id uuid not null,
  version_number integer not null check (version_number >= 1),
  revision_label text not null default 'Initial' check (char_length(btrim(revision_label)) between 1 and 80),
  status text not null default 'draft' check (status in ('draft','in_review','approved','superseded','archived')),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 104857600),
  page_count integer check (page_count is null or page_count >= 1),
  issued_at date,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (blueprint_sheet_id, company_id, project_id)
    references public.blueprint_sheets(id, company_id, project_id) on delete cascade,
  unique (blueprint_sheet_id, version_number)
);

create index blueprint_sets_project_idx on public.blueprint_sets(company_id, project_id, status, updated_at desc);
create index blueprint_sheets_project_idx on public.blueprint_sheets(company_id, project_id, discipline, sort_order);
create index blueprint_versions_sheet_idx on public.blueprint_versions(company_id, project_id, blueprint_sheet_id, version_number desc);
create unique index blueprint_versions_one_working_version_idx
  on public.blueprint_versions(blueprint_sheet_id)
  where status in ('draft','in_review','approved');

alter table public.blueprint_sets enable row level security;
alter table public.blueprint_sheets enable row level security;
alter table public.blueprint_versions enable row level security;

create or replace function public.blueprint_project_belongs_to_company(project_record_id uuid, tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.projects where id = project_record_id and company_id = tenant_id);
$$;

create or replace function public.blueprint_member_of_company(tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and company_id = tenant_id);
$$;

create policy blueprint_sets_select on public.blueprint_sets for select to authenticated
using (public.blueprint_member_of_company(company_id));
create policy blueprint_sets_insert on public.blueprint_sets for insert to authenticated
with check (public.blueprint_member_of_company(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id) and created_by = auth.uid());
create policy blueprint_sets_update on public.blueprint_sets for update to authenticated
using (public.blueprint_member_of_company(company_id))
with check (public.blueprint_member_of_company(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id));
create policy blueprint_sets_delete on public.blueprint_sets for delete to authenticated
using (public.blueprint_member_of_company(company_id));

create policy blueprint_sheets_select on public.blueprint_sheets for select to authenticated
using (public.blueprint_member_of_company(company_id));
create policy blueprint_sheets_insert on public.blueprint_sheets for insert to authenticated
with check (public.blueprint_member_of_company(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id) and created_by = auth.uid());
create policy blueprint_sheets_update on public.blueprint_sheets for update to authenticated
using (public.blueprint_member_of_company(company_id))
with check (public.blueprint_member_of_company(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id));
create policy blueprint_sheets_delete on public.blueprint_sheets for delete to authenticated
using (public.blueprint_member_of_company(company_id));

create policy blueprint_versions_select on public.blueprint_versions for select to authenticated
using (public.blueprint_member_of_company(company_id));
create policy blueprint_versions_insert on public.blueprint_versions for insert to authenticated
with check (public.blueprint_member_of_company(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id) and uploaded_by = auth.uid());
create policy blueprint_versions_update on public.blueprint_versions for update to authenticated
using (public.blueprint_member_of_company(company_id))
with check (public.blueprint_member_of_company(company_id) and public.blueprint_project_belongs_to_company(project_id, company_id));
create policy blueprint_versions_delete on public.blueprint_versions for delete to authenticated
using (public.blueprint_member_of_company(company_id));

create or replace function public.register_blueprint_revision(
  sheet_record_id uuid,
  revision_name text,
  object_path text,
  source_filename text,
  source_mime_type text,
  source_file_size bigint,
  revision_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  sheet_record public.blueprint_sheets%rowtype;
  next_version integer;
  created_version_id uuid;
begin
  select * into sheet_record from public.blueprint_sheets where id = sheet_record_id;
  if not found then raise exception 'Blueprint sheet not found'; end if;
  if not public.blueprint_member_of_company(sheet_record.company_id) then raise exception 'Blueprint access denied'; end if;
  if btrim(revision_name) = '' then raise exception 'Revision label is required'; end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.blueprint_versions where blueprint_sheet_id = sheet_record_id;

  update public.blueprint_versions
  set status = 'superseded'
  where blueprint_sheet_id = sheet_record_id and status in ('draft','in_review','approved');

  insert into public.blueprint_versions (
    company_id, project_id, blueprint_sheet_id, version_number, revision_label,
    status, storage_path, original_filename, mime_type, file_size_bytes, notes, uploaded_by
  ) values (
    sheet_record.company_id, sheet_record.project_id, sheet_record.id, next_version, btrim(revision_name),
    'draft', object_path, source_filename, source_mime_type, source_file_size, nullif(btrim(revision_notes), ''), auth.uid()
  ) returning id into created_version_id;

  return created_version_id;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blueprints', 'blueprints', false, 104857600, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy blueprints_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'blueprints'
  and exists(
    select 1
    from public.profiles profile
    join public.projects project on project.company_id = profile.company_id
    where profile.id = auth.uid()
      and profile.company_id::text = (storage.foldername(name))[1]
      and project.id::text = (storage.foldername(name))[2]
  )
);
create policy blueprints_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'blueprints'
  and exists(
    select 1 from public.blueprint_versions version
    where version.storage_path = name and public.blueprint_member_of_company(version.company_id)
  )
);
create policy blueprints_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'blueprints'
  and exists(select 1 from public.profiles where id = auth.uid() and company_id::text = (storage.foldername(name))[1])
);

do $$ declare v_fn regprocedure; begin
  select p.oid::regprocedure into v_fn
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  join pg_proc p on p.oid=t.tgfoid
  where n.nspname='public' and c.relname='projects' and not t.tgisinternal
  limit 1;
  if v_fn is not null then
    execute format('create trigger trg_blueprint_sets_updated_at before update on public.blueprint_sets for each row execute function %s;', v_fn);
    execute format('create trigger trg_blueprint_sheets_updated_at before update on public.blueprint_sheets for each row execute function %s;', v_fn);
  end if;
end $$;

commit;

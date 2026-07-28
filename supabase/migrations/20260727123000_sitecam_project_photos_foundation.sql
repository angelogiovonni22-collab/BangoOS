begin;

create table if not exists public.project_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid null references public.profiles(id) on delete set null,
  storage_path text not null,
  original_filename text null,
  mime_type text null,
  file_size bigint null,
  category text not null default 'progress',
  note text null,
  captured_at timestamptz null,
  latitude numeric null,
  longitude numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_photos_storage_path_not_blank_check check (btrim(storage_path) <> ''),
  constraint project_photos_category_check check (
    category in (
      'before',
      'progress',
      'after',
      'safety',
      'damage',
      'materials',
      'receipt',
      'inspection',
      'change_order',
      'other'
    )
  ),
  constraint project_photos_file_size_non_negative_check check (file_size is null or file_size >= 0),
  constraint project_photos_latitude_range_check check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint project_photos_longitude_range_check check (longitude is null or (longitude >= -180 and longitude <= 180))
);

create index if not exists idx_project_photos_company_id on public.project_photos(company_id);
create index if not exists idx_project_photos_project_id on public.project_photos(project_id);
create index if not exists idx_project_photos_created_at on public.project_photos(created_at desc);
create index if not exists idx_project_photos_category on public.project_photos(category);
create unique index if not exists idx_project_photos_storage_path_unique on public.project_photos(storage_path);

alter table public.project_photos enable row level security;

drop policy if exists project_photos_select on public.project_photos;
drop policy if exists project_photos_insert on public.project_photos;
drop policy if exists project_photos_update on public.project_photos;
drop policy if exists project_photos_delete on public.project_photos;

create policy project_photos_select
on public.project_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_photos.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_photos.project_id
      and pr.company_id = project_photos.company_id
  )
);

create policy project_photos_insert
on public.project_photos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_photos.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_photos.project_id
      and pr.company_id = project_photos.company_id
  )
  and (
    project_photos.uploaded_by is null
    or exists (
      select 1
      from public.profiles p_up
      where p_up.id = project_photos.uploaded_by
        and p_up.company_id = project_photos.company_id
    )
  )
);

create policy project_photos_update
on public.project_photos
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_photos.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_photos.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_photos.project_id
      and pr.company_id = project_photos.company_id
  )
  and (
    project_photos.uploaded_by is null
    or exists (
      select 1
      from public.profiles p_up
      where p_up.id = project_photos.uploaded_by
        and p_up.company_id = project_photos.company_id
    )
  )
);

create policy project_photos_delete
on public.project_photos
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = project_photos.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_photos.project_id
      and pr.company_id = project_photos.company_id
  )
);

-- Reuse existing updated_at trigger function from current schema to avoid duplicate utility functions.
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
      'tasks'
    )
    and not t.tgisinternal
  order by c.relname, t.tgname
  limit 1;

  if v_fn is null then
    raise exception
      'No existing updated_at trigger function found to reuse. Migration aborted to avoid creating duplicate function.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'project_photos'
      and t.tgname = 'trg_project_photos_set_updated_at'
  ) then
    execute format(
      'create trigger trg_project_photos_set_updated_at before update on public.project_photos for each row execute function %s;',
      v_fn
    );
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-photos',
  'project-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists project_photos_storage_select on storage.objects;
drop policy if exists project_photos_storage_insert on storage.objects;
drop policy if exists project_photos_storage_update on storage.objects;
drop policy if exists project_photos_storage_delete on storage.objects;

create policy project_photos_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1
    from public.project_photos pp
    join public.profiles p on p.id = auth.uid()
    where pp.storage_path = storage.objects.name
      and p.company_id = pp.company_id
  )
);

create policy project_photos_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-photos'
  and split_part(storage.objects.name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and split_part(storage.objects.name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and split_part(storage.objects.name, '/', 3) <> ''
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = split_part(storage.objects.name, '/', 1)::uuid
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = split_part(storage.objects.name, '/', 2)::uuid
      and pr.company_id = split_part(storage.objects.name, '/', 1)::uuid
  )
);

create policy project_photos_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1
    from public.project_photos pp
    join public.profiles p on p.id = auth.uid()
    where pp.storage_path = storage.objects.name
      and p.company_id = pp.company_id
  )
)
with check (
  bucket_id = 'project-photos'
  and exists (
    select 1
    from public.project_photos pp
    join public.profiles p on p.id = auth.uid()
    where pp.storage_path = storage.objects.name
      and p.company_id = pp.company_id
  )
);

create policy project_photos_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1
    from public.project_photos pp
    join public.profiles p on p.id = auth.uid()
    where pp.storage_path = storage.objects.name
      and p.company_id = pp.company_id
  )
);

commit;

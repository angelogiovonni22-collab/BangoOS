begin;

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  project_id uuid null references public.projects(id) on delete cascade,
  estimate_id uuid null references public.estimates(id) on delete cascade,
  label text not null,
  measurement_type text not null default 'length' check (measurement_type in ('length','width','height','opening','area','other')),
  value_inches numeric(14,4) not null check (value_inches > 0),
  method text not null default 'camera_reference' check (method in ('camera_reference','manual')),
  reference_inches numeric(14,4) null,
  confidence text not null default 'user_verified' check (confidence in ('camera_estimate','user_verified')),
  photo_path text null,
  notes text null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint measurements_one_target check ((project_id is not null)::int + (estimate_id is not null)::int = 1)
);

create index if not exists measurements_project_idx on public.measurements(company_id, project_id, created_at desc) where project_id is not null;
create index if not exists measurements_estimate_idx on public.measurements(company_id, estimate_id, created_at desc) where estimate_id is not null;

alter table public.measurements enable row level security;

drop policy if exists measurements_company_select on public.measurements;
create policy measurements_company_select on public.measurements for select using (
  exists (select 1 from public.company_memberships m where m.company_id = measurements.company_id and m.user_id = auth.uid())
);
drop policy if exists measurements_company_insert on public.measurements;
create policy measurements_company_insert on public.measurements for insert with check (
  created_by = auth.uid() and exists (select 1 from public.company_memberships m where m.company_id = measurements.company_id and m.user_id = auth.uid())
);
drop policy if exists measurements_company_update on public.measurements;
create policy measurements_company_update on public.measurements for update using (
  exists (select 1 from public.company_memberships m where m.company_id = measurements.company_id and m.user_id = auth.uid())
) with check (
  exists (select 1 from public.company_memberships m where m.company_id = measurements.company_id and m.user_id = auth.uid())
);
drop policy if exists measurements_company_delete on public.measurements;
create policy measurements_company_delete on public.measurements for delete using (
  exists (select 1 from public.company_memberships m where m.company_id = measurements.company_id and m.user_id = auth.uid())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bos-measurements','bos-measurements',false,10485760,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public=false, file_size_limit=10485760;

drop policy if exists bos_measurements_storage_select on storage.objects;
create policy bos_measurements_storage_select on storage.objects for select using (
  bucket_id='bos-measurements' and exists (
    select 1 from public.company_memberships m where m.user_id=auth.uid() and m.company_id::text=(storage.foldername(name))[1]
  )
);
drop policy if exists bos_measurements_storage_insert on storage.objects;
create policy bos_measurements_storage_insert on storage.objects for insert with check (
  bucket_id='bos-measurements' and exists (
    select 1 from public.company_memberships m where m.user_id=auth.uid() and m.company_id::text=(storage.foldername(name))[1]
  )
);
drop policy if exists bos_measurements_storage_delete on storage.objects;
create policy bos_measurements_storage_delete on storage.objects for delete using (
  bucket_id='bos-measurements' and exists (
    select 1 from public.company_memberships m where m.user_id=auth.uid() and m.company_id::text=(storage.foldername(name))[1]
  )
);

comment on table public.measurements is 'B.O.S. Measure records attached to exactly one project or estimate. Camera-reference values require user verification before save.';

commit;

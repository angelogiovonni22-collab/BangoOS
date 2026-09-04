begin;

create table if not exists public.reality_scans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  project_id uuid null references public.projects(id) on delete cascade,
  estimate_id uuid null references public.estimates(id) on delete cascade,
  label text not null,
  capture_provider text not null default 'apple_roomplan' check (capture_provider in ('apple_roomplan','arkit_lidar','manual_import')),
  capture_kind text not null default 'room' check (capture_kind in ('room','structure')),
  status text not null default 'ready' check (status in ('uploading','processing','ready','failed')),
  source_json_path text null,
  model_path text null,
  device_model text null,
  operating_system text null,
  framework_version text null,
  room_count integer null check (room_count is null or room_count >= 0),
  floor_area_sqft numeric(14,4) null check (floor_area_sqft is null or floor_area_sqft >= 0),
  wall_area_sqft numeric(14,4) null check (wall_area_sqft is null or wall_area_sqft >= 0),
  opening_count integer null check (opening_count is null or opening_count >= 0),
  object_count integer null check (object_count is null or object_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reality_scans_one_target check ((project_id is not null)::int + (estimate_id is not null)::int = 1),
  constraint reality_scans_has_artifact check (source_json_path is not null or model_path is not null)
);

create index if not exists reality_scans_project_idx on public.reality_scans(company_id, project_id, created_at desc) where project_id is not null;
create index if not exists reality_scans_estimate_idx on public.reality_scans(company_id, estimate_id, created_at desc) where estimate_id is not null;

alter table public.reality_scans enable row level security;

drop policy if exists reality_scans_company_select on public.reality_scans;
create policy reality_scans_company_select on public.reality_scans for select using (
  exists (select 1 from public.company_memberships m where m.company_id = reality_scans.company_id and m.user_id = auth.uid())
);

drop policy if exists reality_scans_company_insert on public.reality_scans;
create policy reality_scans_company_insert on public.reality_scans for insert with check (
  created_by = auth.uid() and exists (select 1 from public.company_memberships m where m.company_id = reality_scans.company_id and m.user_id = auth.uid())
);

drop policy if exists reality_scans_company_update on public.reality_scans;
create policy reality_scans_company_update on public.reality_scans for update using (
  exists (select 1 from public.company_memberships m where m.company_id = reality_scans.company_id and m.user_id = auth.uid())
) with check (
  exists (select 1 from public.company_memberships m where m.company_id = reality_scans.company_id and m.user_id = auth.uid())
);

drop policy if exists reality_scans_company_delete on public.reality_scans;
create policy reality_scans_company_delete on public.reality_scans for delete using (
  exists (select 1 from public.company_memberships m where m.company_id = reality_scans.company_id and m.user_id = auth.uid())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reality-scans',
  'reality-scans',
  false,
  524288000,
  array['application/json','model/vnd.usdz+zip','application/octet-stream']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 524288000,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists reality_scans_storage_select on storage.objects;
create policy reality_scans_storage_select on storage.objects for select using (
  bucket_id='reality-scans' and exists (
    select 1 from public.company_memberships m
    where m.user_id=auth.uid() and m.company_id::text=(storage.foldername(name))[1]
  )
);

drop policy if exists reality_scans_storage_insert on storage.objects;
create policy reality_scans_storage_insert on storage.objects for insert with check (
  bucket_id='reality-scans' and exists (
    select 1 from public.company_memberships m
    where m.user_id=auth.uid() and m.company_id::text=(storage.foldername(name))[1]
  )
);

drop policy if exists reality_scans_storage_delete on storage.objects;
create policy reality_scans_storage_delete on storage.objects for delete using (
  bucket_id='reality-scans' and exists (
    select 1 from public.company_memberships m
    where m.user_id=auth.uid() and m.company_id::text=(storage.foldername(name))[1]
  )
);

comment on table public.reality_scans is 'Reality Engine capture registry for tenant-scoped RoomPlan/ARKit/LiDAR scans. Stores only private artifact paths and derived scan summaries.';

commit;

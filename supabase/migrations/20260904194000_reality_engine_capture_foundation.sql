begin;

create table public.reality_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  blueprint_version_id uuid null references public.blueprint_versions(id) on delete set null,
  capture_type text not null check (capture_type in ('roomplan','arkit_mesh','webxr','photogrammetry')),
  status text not null default 'captured' check (status in ('captured','uploading','processing','ready','failed')),
  source_platform text not null default 'web' check (source_platform in ('ios','ipados','web')),
  device_model text null,
  os_version text null,
  app_build text null,
  roomplan_payload jsonb not null default '{}'::jsonb,
  spatial_summary jsonb not null default '{}'::jsonb,
  error_message text null,
  captured_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reality_capture_sessions_company_project_idx
  on public.reality_capture_sessions(company_id, project_id, captured_at desc);

create table public.reality_capture_assets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reality_capture_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('usdz','mesh','thumbnail','depth','photo','metadata')),
  storage_path text not null,
  mime_type text null,
  byte_size bigint null check (byte_size is null or byte_size >= 0),
  sha256 text null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(session_id, asset_kind, storage_path)
);

create index reality_capture_assets_session_idx
  on public.reality_capture_assets(session_id, asset_kind);

create table public.reality_capture_measurements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reality_capture_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  measurement_kind text not null check (measurement_kind in ('length','width','height','area','volume','opening_width','opening_height')),
  label text not null,
  value_meters numeric not null check (value_meters > 0),
  confidence numeric null check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_element_id text null,
  geometry jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index reality_capture_measurements_session_idx
  on public.reality_capture_measurements(session_id, measurement_kind);

alter table public.reality_capture_sessions enable row level security;
alter table public.reality_capture_assets enable row level security;
alter table public.reality_capture_measurements enable row level security;

create policy reality_capture_sessions_select on public.reality_capture_sessions
  for select to authenticated
  using (public.is_company_member(company_id));

create policy reality_capture_sessions_insert on public.reality_capture_sessions
  for insert to authenticated
  with check (
    public.is_company_member(company_id)
    and public.blueprint_project_belongs_to_company(project_id, company_id)
    and created_by = auth.uid()
    and (
      blueprint_version_id is null
      or exists (
        select 1
        from public.blueprint_versions bv
        where bv.id = reality_capture_sessions.blueprint_version_id
          and bv.company_id = reality_capture_sessions.company_id
          and bv.project_id = reality_capture_sessions.project_id
      )
    )
  );

create policy reality_capture_sessions_update on public.reality_capture_sessions
  for update to authenticated
  using (public.is_company_member(company_id))
  with check (
    public.is_company_member(company_id)
    and public.blueprint_project_belongs_to_company(project_id, company_id)
    and (
      blueprint_version_id is null
      or exists (
        select 1
        from public.blueprint_versions bv
        where bv.id = reality_capture_sessions.blueprint_version_id
          and bv.company_id = reality_capture_sessions.company_id
          and bv.project_id = reality_capture_sessions.project_id
      )
    )
  );

create policy reality_capture_sessions_delete on public.reality_capture_sessions
  for delete to authenticated
  using (public.is_company_member(company_id) and created_by = auth.uid());

create policy reality_capture_assets_select on public.reality_capture_assets
  for select to authenticated
  using (public.is_company_member(company_id));

create policy reality_capture_assets_insert on public.reality_capture_assets
  for insert to authenticated
  with check (
    public.is_company_member(company_id)
    and public.blueprint_project_belongs_to_company(project_id, company_id)
    and created_by = auth.uid()
    and exists (
      select 1
      from public.reality_capture_sessions s
      where s.id = reality_capture_assets.session_id
        and s.company_id = reality_capture_assets.company_id
        and s.project_id = reality_capture_assets.project_id
    )
  );

create policy reality_capture_assets_delete on public.reality_capture_assets
  for delete to authenticated
  using (public.is_company_member(company_id) and created_by = auth.uid());

create policy reality_capture_measurements_select on public.reality_capture_measurements
  for select to authenticated
  using (public.is_company_member(company_id));

create policy reality_capture_measurements_insert on public.reality_capture_measurements
  for insert to authenticated
  with check (
    public.is_company_member(company_id)
    and public.blueprint_project_belongs_to_company(project_id, company_id)
    and created_by = auth.uid()
    and exists (
      select 1
      from public.reality_capture_sessions s
      where s.id = reality_capture_measurements.session_id
        and s.company_id = reality_capture_measurements.company_id
        and s.project_id = reality_capture_measurements.project_id
    )
  );

create policy reality_capture_measurements_delete on public.reality_capture_measurements
  for delete to authenticated
  using (public.is_company_member(company_id) and created_by = auth.uid());

commit;

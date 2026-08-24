begin;

create table if not exists public.project_intelligence_artifacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null check (source_type in ('project','photo','attachment','blueprint')),
  source_id uuid,
  source_key text not null check (btrim(source_key) <> ''),
  source_label text not null default '',
  source_mime_type text,
  model text,
  summary text not null default '',
  observations jsonb not null default '[]'::jsonb check (jsonb_typeof(observations) = 'array'),
  risks jsonb not null default '[]'::jsonb check (jsonb_typeof(risks) = 'array'),
  recommendations jsonb not null default '[]'::jsonb check (jsonb_typeof(recommendations) = 'array'),
  extracted_facts jsonb not null default '{}'::jsonb check (jsonb_typeof(extracted_facts) = 'object'),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_by uuid references public.profiles(id) on delete set null,
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, project_id, source_key)
);

create index if not exists project_intelligence_project_idx
  on public.project_intelligence_artifacts(company_id, project_id, analyzed_at desc);
create index if not exists project_intelligence_source_idx
  on public.project_intelligence_artifacts(company_id, project_id, source_type, source_id);

alter table public.project_intelligence_artifacts enable row level security;

revoke all on public.project_intelligence_artifacts from anon;
grant select, insert, update, delete on public.project_intelligence_artifacts to authenticated;

drop policy if exists project_intelligence_select on public.project_intelligence_artifacts;
create policy project_intelligence_select on public.project_intelligence_artifacts
for select to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = project_intelligence_artifacts.company_id
  )
  and exists (
    select 1 from public.projects pr
    where pr.id = project_intelligence_artifacts.project_id and pr.company_id = project_intelligence_artifacts.company_id
  )
);

drop policy if exists project_intelligence_insert on public.project_intelligence_artifacts;
create policy project_intelligence_insert on public.project_intelligence_artifacts
for insert to authenticated with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = project_intelligence_artifacts.company_id
  )
  and exists (
    select 1 from public.projects pr
    where pr.id = project_intelligence_artifacts.project_id and pr.company_id = project_intelligence_artifacts.company_id
  )
);

drop policy if exists project_intelligence_update on public.project_intelligence_artifacts;
create policy project_intelligence_update on public.project_intelligence_artifacts
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = project_intelligence_artifacts.company_id
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = project_intelligence_artifacts.company_id
  )
  and exists (
    select 1 from public.projects pr
    where pr.id = project_intelligence_artifacts.project_id and pr.company_id = project_intelligence_artifacts.company_id
  )
);

drop policy if exists project_intelligence_delete on public.project_intelligence_artifacts;
create policy project_intelligence_delete on public.project_intelligence_artifacts
for delete to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = project_intelligence_artifacts.company_id
  )
);

commit;

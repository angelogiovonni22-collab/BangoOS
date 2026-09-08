begin;

alter table public.blueprint_generated_models
  add column if not exists engine_status text,
  add column if not exists building_graph jsonb,
  add column if not exists validation_report jsonb,
  add column if not exists reconstruction_version text,
  add column if not exists algorithm_versions jsonb not null default '{}'::jsonb,
  add column if not exists source_page integer,
  add column if not exists correction_history jsonb not null default '[]'::jsonb;

update public.blueprint_generated_models
set engine_status = case status
  when 'pending' then 'queued'
  when 'processing' then 'processing'
  when 'ready' then 'reconstructed'
  when 'needs_input' then 'needs_input'
  when 'failed' then 'failed'
  else 'needs_review'
end
where engine_status is null;

alter table public.blueprint_generated_models
  alter column engine_status set default 'queued',
  alter column engine_status set not null;

alter table public.blueprint_generated_models
  drop constraint if exists blueprint_generated_models_engine_status_check;

alter table public.blueprint_generated_models
  add constraint blueprint_generated_models_engine_status_check
  check (engine_status in ('queued','processing','reconstructed','needs_review','needs_input','failed'));

alter table public.blueprint_generated_models
  drop constraint if exists blueprint_generated_models_source_page_check;

alter table public.blueprint_generated_models
  add constraint blueprint_generated_models_source_page_check
  check (source_page is null or source_page > 0);

create index if not exists blueprint_generated_models_engine_status_idx
  on public.blueprint_generated_models(company_id, engine_status, updated_at desc);

comment on column public.blueprint_generated_models.building_graph is
'Canonical tenant-scoped B.O.S. Building Graph. Geometry carries source evidence, confidence, provenance, and correction state.';
comment on column public.blueprint_generated_models.validation_report is
'Native Blueprint Engine validation report used to prevent visibly bad reconstructions from being presented as successful.';
comment on column public.blueprint_generated_models.engine_status is
'Native reconstruction state. reconstructed is only used after validation thresholds pass; needs_review and needs_input preserve uncertainty.';
comment on column public.blueprint_generated_models.correction_history is
'Append-only logical correction provenance retained across model regeneration.';

commit;

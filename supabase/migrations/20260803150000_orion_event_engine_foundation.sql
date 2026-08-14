begin;

alter table public.workflow_events
  add column if not exists workspace_id uuid null,
  add column if not exists version integer not null default 1,
  add column if not exists source_module text null,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists correlation_id text null,
  add column if not exists causation_id uuid null,
  add column if not exists idempotency_key text null;

alter table public.workflow_events
  drop constraint if exists workflow_events_version_check,
  add constraint workflow_events_version_check
    check (version >= 1)
    not valid;

alter table public.workflow_events
  drop constraint if exists workflow_events_source_module_not_blank_check,
  add constraint workflow_events_source_module_not_blank_check
    check (source_module is null or btrim(source_module) <> '')
    not valid;

alter table public.workflow_events
  drop constraint if exists workflow_events_idempotency_key_not_blank_check,
  add constraint workflow_events_idempotency_key_not_blank_check
    check (idempotency_key is null or btrim(idempotency_key) <> '')
    not valid;

alter table public.workflow_events
  drop constraint if exists workflow_events_causation_event_fkey,
  add constraint workflow_events_causation_event_fkey
    foreign key (causation_id)
    references public.workflow_events(id)
    on delete set null;

create unique index if not exists idx_workflow_events_company_event_idempotency
  on public.workflow_events(company_id, event_type, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_workflow_events_company_source_module
  on public.workflow_events(company_id, source_module, occurred_at desc)
  where source_module is not null;

commit;

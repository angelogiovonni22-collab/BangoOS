begin;

-- Orion command-history and navigation events may not have an entity UUID.
alter table public.workflow_events
  alter column reference_id drop not null;

commit;

begin;

create table if not exists public.bos_intelligence_usage_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  product text not null check (product in (
    'orion_text',
    'orion_voice',
    'orion_document',
    'orion_autonomous_action',
    'blueprint_native_analysis',
    'blueprint_vision_analysis',
    'blueprint_3d_reconstruction',
    'blueprint_visual_mockup'
  )),
  outcome text not null check (outcome in ('succeeded', 'provider_failed', 'bos_failed', 'customer_canceled')),
  quantity integer not null default 1 check (quantity > 0),
  internal_non_billable boolean not null default false,
  provider text,
  provider_model text,
  provider_request_id text,
  input_units bigint check (input_units is null or input_units >= 0),
  output_units bigint check (output_units is null or output_units >= 0),
  total_units bigint check (total_units is null or total_units >= 0),
  provider_cost_micros bigint not null default 0 check (provider_cost_micros >= 0),
  operation_key text not null check (char_length(btrim(operation_key)) between 8 and 200),
  correlation_id uuid,
  source_type text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (company_id, operation_key)
);

create index if not exists bos_intelligence_usage_events_company_created_idx
  on public.bos_intelligence_usage_events (company_id, created_at desc);
create index if not exists bos_intelligence_usage_events_product_created_idx
  on public.bos_intelligence_usage_events (company_id, product, created_at desc);
create index if not exists bos_intelligence_usage_events_provider_created_idx
  on public.bos_intelligence_usage_events (company_id, provider, created_at desc)
  where provider is not null;

alter table public.bos_intelligence_usage_events enable row level security;

create policy "company billing administrators read intelligence usage events"
  on public.bos_intelligence_usage_events for select to authenticated
  using (
    (select private.is_bos_platform_admin())
    or exists (
      select 1
      from public.company_memberships membership
      where membership.company_id = bos_intelligence_usage_events.company_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('owner', 'administrator')
    )
  );

create trigger bos_intelligence_usage_events_immutable
before update or delete on public.bos_intelligence_usage_events
for each row execute function private.reject_bos_intelligence_ledger_mutation();

revoke all privileges on table public.bos_intelligence_usage_events from anon;
revoke all privileges on table public.bos_intelligence_usage_events from authenticated;
revoke all privileges on table public.bos_intelligence_usage_events from service_role;

grant select on table public.bos_intelligence_usage_events to authenticated;
grant select, insert on table public.bos_intelligence_usage_events to service_role;

comment on table public.bos_intelligence_usage_events is
  'Append-only non-settling telemetry for Orion and Blueprint Intelligence provider usage. Events never change customer credit balances.';

commit;

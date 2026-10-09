-- Durable Orion event subscriber delivery state.
--
-- workflow_events remains the canonical event ledger. This migration adds a
-- per-event subscriber snapshot plus retryable delivery rows so an event that
-- was committed before a subscriber failed can be safely retried without
-- re-running subscribers that already completed.

create unique index if not exists workflow_events_id_company_unique
  on public.workflow_events(id, company_id);

create table if not exists public.workflow_event_delivery_batches (
  event_id uuid primary key,
  company_id uuid not null,
  subscriber_keys text[] not null default '{}'::text[],
  initialized_at timestamptz not null default now(),

  constraint workflow_event_delivery_batches_event_company_fkey
    foreign key (event_id, company_id)
    references public.workflow_events(id, company_id)
    on delete cascade,

  constraint workflow_event_delivery_batches_subscriber_keys_check
    check (array_position(subscriber_keys, null) is null)
);

create table if not exists public.workflow_event_deliveries (
  event_id uuid not null,
  company_id uuid not null,
  subscriber_key text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz null,
  last_attempted_at timestamptz null,
  delivered_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workflow_event_deliveries_pkey
    primary key (event_id, subscriber_key),

  constraint workflow_event_deliveries_event_company_fkey
    foreign key (event_id, company_id)
    references public.workflow_events(id, company_id)
    on delete cascade,

  constraint workflow_event_deliveries_subscriber_key_check
    check (btrim(subscriber_key) <> ''),

  constraint workflow_event_deliveries_status_check
    check (status in ('pending', 'processing', 'failed', 'delivered')),

  constraint workflow_event_deliveries_attempt_count_check
    check (attempt_count >= 0),

  constraint workflow_event_deliveries_delivered_state_check
    check ((status = 'delivered' and delivered_at is not null) or status <> 'delivered')
);

create index if not exists workflow_event_deliveries_retry_idx
  on public.workflow_event_deliveries(company_id, status, available_at, lease_until);

alter table public.workflow_event_delivery_batches enable row level security;
alter table public.workflow_event_deliveries enable row level security;

create policy workflow_event_delivery_batches_select
on public.workflow_event_delivery_batches
for select to authenticated
using (
  public.has_company_role(
    company_id,
    array[
      'owner'::text,
      'administrator'::text,
      'operations_manager'::text,
      'project_manager'::text,
      'superintendent'::text,
      'foreman'::text,
      'office_manager'::text
    ]
  )
);

create policy workflow_event_delivery_batches_insert
on public.workflow_event_delivery_batches
for insert to authenticated
with check (
  public.has_company_role(
    company_id,
    array[
      'owner'::text,
      'administrator'::text,
      'operations_manager'::text,
      'project_manager'::text,
      'superintendent'::text,
      'foreman'::text,
      'office_manager'::text
    ]
  )
);

create policy workflow_event_deliveries_select
on public.workflow_event_deliveries
for select to authenticated
using (
  public.has_company_role(
    company_id,
    array[
      'owner'::text,
      'administrator'::text,
      'operations_manager'::text,
      'project_manager'::text,
      'superintendent'::text,
      'foreman'::text,
      'office_manager'::text
    ]
  )
);

create policy workflow_event_deliveries_insert
on public.workflow_event_deliveries
for insert to authenticated
with check (
  public.has_company_role(
    company_id,
    array[
      'owner'::text,
      'administrator'::text,
      'operations_manager'::text,
      'project_manager'::text,
      'superintendent'::text,
      'foreman'::text,
      'office_manager'::text
    ]
  )
);

create policy workflow_event_deliveries_update
on public.workflow_event_deliveries
for update to authenticated
using (
  public.has_company_role(
    company_id,
    array[
      'owner'::text,
      'administrator'::text,
      'operations_manager'::text,
      'project_manager'::text,
      'superintendent'::text,
      'foreman'::text,
      'office_manager'::text
    ]
  )
)
with check (
  public.has_company_role(
    company_id,
    array[
      'owner'::text,
      'administrator'::text,
      'operations_manager'::text,
      'project_manager'::text,
      'superintendent'::text,
      'foreman'::text,
      'office_manager'::text
    ]
  )
);

create or replace function public.initialize_workflow_event_delivery_batch(
  p_event_id uuid,
  p_subscriber_keys text[]
)
returns text[]
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_snapshot text[];
  v_inserted boolean := false;
begin
  select event.company_id
  into v_company_id
  from public.workflow_events as event
  where event.id = p_event_id;

  if v_company_id is null then
    raise exception 'Workflow event is not visible or does not exist.';
  end if;

  v_snapshot := coalesce(
    array(
      select distinct btrim(key_value)
      from unnest(coalesce(p_subscriber_keys, '{}'::text[])) as key_value
      where btrim(key_value) <> ''
      order by btrim(key_value)
    ),
    '{}'::text[]
  );

  insert into public.workflow_event_delivery_batches (
    event_id,
    company_id,
    subscriber_keys
  )
  values (
    p_event_id,
    v_company_id,
    v_snapshot
  )
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;

  select batch.subscriber_keys
  into v_snapshot
  from public.workflow_event_delivery_batches as batch
  where batch.event_id = p_event_id;

  if v_inserted then
    insert into public.workflow_event_deliveries (
      event_id,
      company_id,
      subscriber_key,
      status
    )
    select
      p_event_id,
      v_company_id,
      key_value,
      'pending'
    from unnest(v_snapshot) as key_value
    on conflict (event_id, subscriber_key) do nothing;
  end if;

  return coalesce(v_snapshot, '{}'::text[]);
end;
$$;

create or replace function public.claim_workflow_event_deliveries(
  p_event_id uuid,
  p_subscriber_keys text[],
  p_lease_seconds integer default 60
)
returns table(subscriber_key text)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_lease_seconds integer;
begin
  v_lease_seconds := greatest(5, least(coalesce(p_lease_seconds, 60), 900));

  return query
  with candidates as (
    select delivery.event_id, delivery.subscriber_key
    from public.workflow_event_deliveries as delivery
    where delivery.event_id = p_event_id
      and delivery.subscriber_key = any(coalesce(p_subscriber_keys, '{}'::text[]))
      and delivery.available_at <= now()
      and (
        delivery.status in ('pending', 'failed')
        or (
          delivery.status = 'processing'
          and delivery.lease_until is not null
          and delivery.lease_until <= now()
        )
      )
    order by delivery.subscriber_key
    for update skip locked
  ), claimed as (
    update public.workflow_event_deliveries as delivery
    set
      status = 'processing',
      attempt_count = delivery.attempt_count + 1,
      last_attempted_at = now(),
      lease_until = now() + make_interval(secs => v_lease_seconds),
      last_error = null,
      updated_at = now()
    from candidates
    where delivery.event_id = candidates.event_id
      and delivery.subscriber_key = candidates.subscriber_key
    returning delivery.subscriber_key
  )
  select claimed.subscriber_key
  from claimed
  order by claimed.subscriber_key;
end;
$$;

create or replace function public.complete_workflow_event_delivery(
  p_event_id uuid,
  p_subscriber_key text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  update public.workflow_event_deliveries
  set
    status = 'delivered',
    delivered_at = now(),
    lease_until = null,
    last_error = null,
    updated_at = now()
  where event_id = p_event_id
    and subscriber_key = p_subscriber_key
    and status = 'processing';

  if not found then
    raise exception 'Workflow event delivery is not currently claimed.';
  end if;
end;
$$;

create or replace function public.fail_workflow_event_delivery(
  p_event_id uuid,
  p_subscriber_key text,
  p_error text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  update public.workflow_event_deliveries
  set
    status = 'failed',
    available_at = now(),
    lease_until = null,
    last_error = left(coalesce(nullif(btrim(p_error), ''), 'Subscriber delivery failed.'), 2000),
    updated_at = now()
  where event_id = p_event_id
    and subscriber_key = p_subscriber_key
    and status = 'processing';

  if not found then
    raise exception 'Workflow event delivery is not currently claimed.';
  end if;
end;
$$;

revoke all on function public.initialize_workflow_event_delivery_batch(uuid, text[]) from public;
revoke all on function public.claim_workflow_event_deliveries(uuid, text[], integer) from public;
revoke all on function public.complete_workflow_event_delivery(uuid, text) from public;
revoke all on function public.fail_workflow_event_delivery(uuid, text, text) from public;

grant execute on function public.initialize_workflow_event_delivery_batch(uuid, text[]) to authenticated;
grant execute on function public.claim_workflow_event_deliveries(uuid, text[], integer) to authenticated;
grant execute on function public.complete_workflow_event_delivery(uuid, text) to authenticated;
grant execute on function public.fail_workflow_event_delivery(uuid, text, text) to authenticated;

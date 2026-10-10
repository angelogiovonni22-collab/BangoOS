begin;

create table if not exists public.orion_event_deliveries (
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id uuid not null references public.workflow_events(id) on delete cascade,
  subscriber_key text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed', 'delivered')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, event_id, subscriber_key)
);

create index if not exists idx_orion_event_deliveries_retry
  on public.orion_event_deliveries (status, lease_expires_at, updated_at)
  where status in ('pending', 'processing', 'failed');

alter table public.orion_event_deliveries enable row level security;

revoke all on table public.orion_event_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.orion_event_deliveries to service_role;

create or replace function public.claim_orion_event_delivery(
  p_company_id uuid,
  p_event_id uuid,
  p_subscriber_key text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_lease_expires_at timestamptz;
  v_is_service_role boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
begin
  if p_company_id is null or p_event_id is null or nullif(btrim(p_subscriber_key), '') is null then
    raise exception 'Invalid Orion delivery claim';
  end if;

  if not v_is_service_role
     and not exists (
       select 1
       from public.profiles p
       where p.id = (select auth.uid())
         and p.company_id = p_company_id
     ) then
    raise exception 'Unauthorized Orion delivery access';
  end if;

  if not exists (
    select 1
    from public.workflow_events e
    where e.id = p_event_id
      and e.company_id = p_company_id
  ) then
    raise exception 'Orion event not found for company';
  end if;

  insert into public.orion_event_deliveries (
    company_id,
    event_id,
    subscriber_key,
    status,
    updated_at
  ) values (
    p_company_id,
    p_event_id,
    btrim(p_subscriber_key),
    'pending',
    now()
  )
  on conflict (company_id, event_id, subscriber_key) do nothing;

  select d.status, d.lease_expires_at
    into v_status, v_lease_expires_at
  from public.orion_event_deliveries d
  where d.company_id = p_company_id
    and d.event_id = p_event_id
    and d.subscriber_key = btrim(p_subscriber_key)
  for update;

  if v_status = 'delivered' then
    return 'delivered';
  end if;

  if v_status = 'processing' and v_lease_expires_at is not null and v_lease_expires_at > now() then
    return 'leased';
  end if;

  update public.orion_event_deliveries d
  set status = 'processing',
      attempt_count = d.attempt_count + 1,
      last_attempt_at = now(),
      lease_expires_at = now() + interval '90 seconds',
      last_error = null,
      updated_at = now()
  where d.company_id = p_company_id
    and d.event_id = p_event_id
    and d.subscriber_key = btrim(p_subscriber_key);

  return 'claimed';
end;
$$;

create or replace function public.complete_orion_event_delivery(
  p_company_id uuid,
  p_event_id uuid,
  p_subscriber_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_service_role boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
begin
  if not v_is_service_role
     and not exists (
       select 1
       from public.profiles p
       where p.id = (select auth.uid())
         and p.company_id = p_company_id
     ) then
    raise exception 'Unauthorized Orion delivery access';
  end if;

  update public.orion_event_deliveries d
  set status = 'delivered',
      delivered_at = coalesce(d.delivered_at, now()),
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
  where d.company_id = p_company_id
    and d.event_id = p_event_id
    and d.subscriber_key = btrim(p_subscriber_key)
    and d.status = 'processing';

  if not found then
    raise exception 'Orion delivery is not currently claimed';
  end if;
end;
$$;

create or replace function public.fail_orion_event_delivery(
  p_company_id uuid,
  p_event_id uuid,
  p_subscriber_key text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_service_role boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
begin
  if not v_is_service_role
     and not exists (
       select 1
       from public.profiles p
       where p.id = (select auth.uid())
         and p.company_id = p_company_id
     ) then
    raise exception 'Unauthorized Orion delivery access';
  end if;

  update public.orion_event_deliveries d
  set status = 'failed',
      lease_expires_at = null,
      last_error = left(coalesce(p_error, 'Subscriber failed'), 4000),
      updated_at = now()
  where d.company_id = p_company_id
    and d.event_id = p_event_id
    and d.subscriber_key = btrim(p_subscriber_key)
    and d.status = 'processing';

  if not found then
    raise exception 'Orion delivery is not currently claimed';
  end if;
end;
$$;

revoke all on function public.claim_orion_event_delivery(uuid, uuid, text) from public, anon;
revoke all on function public.complete_orion_event_delivery(uuid, uuid, text) from public, anon;
revoke all on function public.fail_orion_event_delivery(uuid, uuid, text, text) from public, anon;

grant execute on function public.claim_orion_event_delivery(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.complete_orion_event_delivery(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.fail_orion_event_delivery(uuid, uuid, text, text) to authenticated, service_role;

commit;

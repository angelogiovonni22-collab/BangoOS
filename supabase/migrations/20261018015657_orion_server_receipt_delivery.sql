begin;

-- A private database worker: no public endpoint or browser credential is needed.
create schema if not exists orion_workers;
revoke all on schema orion_workers from public, anon, authenticated;
grant usage on schema orion_workers to service_role;

alter table public.orion_event_deliveries
  add column if not exists next_attempt_at timestamptz;
create index if not exists orion_event_deliveries_event_idx
  on public.orion_event_deliveries (event_id);
create index if not exists orion_server_receipt_due_idx
  on public.orion_event_deliveries (next_attempt_at, created_at, event_id)
  where subscriber_key = 'server:payment-receipt-inbox:v1'
    and status in ('pending', 'failed') and attempt_count < 5;

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
  if not v_is_service_role and btrim(p_subscriber_key) like 'server:%' then
    raise exception 'Server-managed Orion delivery';
  end if;

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
  if not v_is_service_role and btrim(p_subscriber_key) like 'server:%' then
    raise exception 'Server-managed Orion delivery';
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
  if not v_is_service_role and btrim(p_subscriber_key) like 'server:%' then
    raise exception 'Server-managed Orion delivery';
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


-- Enqueue only new payment events. Existing ledger history is not replayed.
-- The delivery row commits in the SAME transaction as its workflow event.
create or replace function orion_workers.enqueue_payment_receipt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.orion_event_deliveries
    (company_id, event_id, subscriber_key, status, next_attempt_at)
  values (new.company_id, new.id, 'server:payment-receipt-inbox:v1', 'pending', now())
  on conflict (company_id, event_id, subscriber_key) do nothing;
  return new;
end;
$$;
revoke all on function orion_workers.enqueue_payment_receipt() from public, anon, authenticated;

drop trigger if exists enqueue_orion_payment_receipt on public.workflow_events;
create trigger enqueue_orion_payment_receipt
  after insert on public.workflow_events for each row
  when (new.event_type = 'payment.received')
  execute function orion_workers.enqueue_payment_receipt();

create or replace function orion_workers.process_payment_receipts(p_batch_size integer default 25)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  delivery record;
  receipt record;
  delivered_count integer := 0;
  failed_count integer := 0;
  terminal_count integer := 0;
  attempt integer;
begin
  if p_batch_size is null or p_batch_size not between 1 and 100 then
    raise exception 'Batch size must be between 1 and 100';
  end if;
  -- Row locks remain held through notification + completion. A killed worker
  -- rolls both back; another run can retry without an expired-worker race.
  for delivery in
    select d.* from public.orion_event_deliveries d
    where d.subscriber_key = 'server:payment-receipt-inbox:v1'
      and d.status in ('pending', 'failed') and d.attempt_count < 5
      and d.next_attempt_at <= now()
    order by d.next_attempt_at, d.created_at, d.event_id
    limit p_batch_size for update skip locked
  loop
    attempt := delivery.attempt_count + 1;
    update public.orion_event_deliveries
      set status = 'processing', attempt_count = attempt,
          last_attempt_at = now(), updated_at = now()
      where company_id = delivery.company_id and event_id = delivery.event_id
        and subscriber_key = delivery.subscriber_key;
    begin
      -- Ignore payload amounts, links and recipients: use committed, company-
      -- scoped receipt/invoice rows and an active membership for the recorder.
      select p.id, p.invoice_id, p.amount, p.payment_date, p.created_by,
             i.invoice_number
        into receipt
      from public.workflow_events e
      join public.invoice_payment_history p
        on p.id = e.reference_id and p.company_id = e.company_id
      join public.invoices i on i.id = p.invoice_id and i.company_id = p.company_id
      join public.company_memberships m
        on m.company_id = p.company_id and m.user_id = p.created_by and m.status = 'active'
      where e.id = delivery.event_id and e.company_id = delivery.company_id
        and e.event_type = 'payment.received' and e.reference_entity = 'payment'
        and e.actor_profile_id = p.created_by
        and p.status = 'recorded' and p.amount > 0;
      if not found then
        raise exception 'Receipt or active recorder not found for payment event';
      end if;

      insert into public.bos_notifications (
        company_id, recipient_user_id, actor_user_id, category, severity,
        title, message, entity_type, entity_id, linked_href, source_module,
        source_key, requested_channels, delivery_state, delivery_metadata
      ) values (
        delivery.company_id, receipt.created_by, receipt.created_by, 'finance', 'success',
        'Payment recorded',
        left(format('%s recorded for invoice %s on %s.',
          receipt.amount, receipt.invoice_number, receipt.payment_date), 2000),
        'invoice', receipt.invoice_id, '/invoices/' || receipt.invoice_id::text,
        'orion', 'orion:payment-receipt:' || receipt.id::text,
        array['in_app']::text[], 'ready',
        jsonb_build_object('orion_event_id', delivery.event_id, 'receipt_id', receipt.id,
          'subscriber_key', delivery.subscriber_key)
      ) on conflict (company_id, recipient_user_id, source_key)
        where source_key is not null do nothing;

      update public.orion_event_deliveries
        set status = 'delivered', delivered_at = now(), last_error = null,
            next_attempt_at = null, lease_expires_at = null, updated_at = now()
        where company_id = delivery.company_id and event_id = delivery.event_id
          and subscriber_key = delivery.subscriber_key;
      delivered_count := delivered_count + 1;
    exception when others then
      -- This subtransaction rolls back the notification and completion together.
      -- Persist the failed attempt, then move on so one bad event cannot starve others.
      update public.orion_event_deliveries
        set status = 'failed', last_error = left(sqlerrm, 4000),
            next_attempt_at = case when attempt < 5
              then now() + make_interval(secs => (30 * power(2, attempt - 1))::integer)
              else null end,
            lease_expires_at = null, updated_at = now()
        where company_id = delivery.company_id and event_id = delivery.event_id
          and subscriber_key = delivery.subscriber_key;
      failed_count := failed_count + 1;
      if attempt >= 5 then terminal_count := terminal_count + 1; end if;
    end;
  end loop;
  return jsonb_build_object('delivered', delivered_count, 'failed', failed_count,
    'needs_attention', terminal_count);
end;
$$;
revoke all on function orion_workers.process_payment_receipts(integer) from public, anon, authenticated;
grant execute on function orion_workers.process_payment_receipts(integer) to service_role;

-- Operational failures remain inspectable after the retry budget is exhausted.
create or replace view orion_workers.receipt_delivery_health
with (security_invoker = true) as
select company_id, event_id, status, attempt_count, next_attempt_at,
       last_attempt_at, delivered_at, last_error,
       (status = 'failed' and attempt_count >= 5) as needs_attention
from public.orion_event_deliveries
where subscriber_key = 'server:payment-receipt-inbox:v1';
revoke all on orion_workers.receipt_delivery_health from public, anon, authenticated;
grant select on orion_workers.receipt_delivery_health to service_role;

-- pg_cron already runs the existing Orion dispatcher on this project.
-- This job performs no HTTP calls and never sends email or push notifications.
select cron.schedule('orion-payment-receipt-inbox', '* * * * *',
  'select orion_workers.process_payment_receipts(25);');

commit;

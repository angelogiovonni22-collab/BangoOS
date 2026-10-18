# Server receipt delivery

The first scheduled Orion subscriber creates one in-app payment confirmation for the active company member who recorded a committed receipt. It does not send email/push, charge money, run estimate/project automations, or backfill historical events.

## Execution

An AFTER INSERT trigger on new `payment.received` workflow events adds `server:payment-receipt-inbox:v1` to the existing delivery ledger in the same transaction. `orion-payment-receipt-inbox` runs every minute using the existing Supabase pg_cron scheduler. It processes up to 25 due deliveries per invocation; operator calls accept 1–100.

The worker is a private, SECURITY INVOKER database function. Browser roles have neither schema usage nor execute permission. The legacy browser claim/complete/fail RPCs reject reserved `server:` keys. Notification and completion execute in one transaction under a row lock; SKIP LOCKED allows independent invocations without sharing a delivery. A crash rolls back the whole transaction. The existing notification unique index deduplicates by company, recorder and receipt UUID, including when two different events refer to the same receipt.

The worker validates the committed receipt and invoice within the event company, requires a recorded positive receipt, checks event actor against receipt creator and confirms active company membership. Recipient, amount and link come from those database records, not event payload text. Financial source records are never modified by delivery.

Failures remain durable and do not block later rows. Automatic delays are 30, 60, 120 and 240 seconds after attempts 1–4; the minute scheduler may make actual delays longer. After attempt 5, status stays failed and no further automatic retry is scheduled. Operators must investigate, correct the cause and explicitly requeue. Row locking plus atomic in-database effects replaces lease-based handling for this server-only subscriber; the generic browser subscriber API retains its existing behavior for other keys.

## Monitoring (trusted database operator only)

```sql
select * from orion_workers.receipt_delivery_health
where status <> 'delivered'
order by needs_attention desc, next_attempt_at nulls last;

select status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname='orion-payment-receipt-inbox')
order by start_time desc limit 20;
```

The health view is private and includes company/event, last error, attempts, next retry and needs_attention. Existing notification inbox shows successful confirmations. There is no new customer-facing error dashboard in this slice. Raw SQL errors stay restricted to operators.

After fixing a specific failure, a trusted operator can requeue only its exact company/event/subscriber. Resetting attempt_count starts a new five-attempt retry budget; investigate and retain the previous failure evidence first. Do not mass reset the ledger.

```sql
-- Bind verified UUIDs; never paste this with placeholder values.
update public.orion_event_deliveries
set status='pending', attempt_count=0, next_attempt_at=now(), last_error=null,
    delivered_at=null, updated_at=now()
where company_id=:company_id and event_id=:event_id
  and subscriber_key='server:payment-receipt-inbox:v1' and status='failed';
```

## Pause and resume

```sql
select cron.alter_job((select jobid from cron.job where jobname='orion-payment-receipt-inbox'), active := false);
-- Resume with active := true. Enqueue remains active while paused, preserving backlog.
```

Do not delete the trigger/ledger as an emergency pause: that loses new work. Never expose this schema through the public Data API.

## Validation

Run `supabase/tests/orion-server-receipt-delivery.sql` inside a transaction and ROLLBACK. It creates synthetic receipts/events/notifications only inside that transaction. It checks enqueue, duplicate replay, duplicate receipt events, durable failure/backoff, recovery, retry exhaustion, browser isolation, reserved-key protections, bounded batches and atomic rollback when completion fails after notification insertion.

For live acceptance, create only an explicitly labeled disposable invoice/receipt and inspect its queued event. Leave the app closed during a scheduler tick, verify one notification and delivered status, then inspect the authenticated inbox. Test overlapping worker calls with two independent transactions. Remove only the synthetic invoice, receipt, notifications and events after acceptance; confirm finance totals are restored. Do not force errors against real receipts or change owner roles.

The database suite verifies this implementation; it does not prove all external side effects are exactly-once. Future email, payment or multi-step automation subscribers need their own idempotency and recovery design. Browser-independent processing begins after the canonical workflow event commits; this slice does not make the preceding receipt-to-event publication transaction atomic.

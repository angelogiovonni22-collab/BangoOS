begin;

alter table public.bos_tenant_accounts
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id text,
  add column if not exists billing_interval text,
  add column if not exists subscription_status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists payment_method_status text,
  add column if not exists last_payment_at timestamptz,
  add column if not exists last_webhook_event_at timestamptz;

alter table public.bos_tenant_accounts
  drop constraint if exists bos_tenant_accounts_billing_interval_check,
  add constraint bos_tenant_accounts_billing_interval_check
    check (billing_interval is null or billing_interval in ('month', 'year'));

create unique index if not exists bos_tenant_accounts_stripe_customer_uidx
  on public.bos_tenant_accounts (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists bos_tenant_accounts_stripe_subscription_uidx
  on public.bos_tenant_accounts (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.bos_billing_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  company_id uuid references public.companies(id) on delete set null,
  livemode boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  error_message text,
  event_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists bos_billing_webhook_events_company_received_idx
  on public.bos_billing_webhook_events (company_id, received_at desc);

alter table public.bos_billing_webhook_events enable row level security;

drop policy if exists "company billing administrators read tenant account" on public.bos_tenant_accounts;
create policy "company billing administrators read tenant account"
  on public.bos_tenant_accounts for select to authenticated
  using (
    exists (
      select 1
      from public.company_memberships membership
      where membership.company_id = bos_tenant_accounts.company_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('owner', 'administrator')
    )
  );

create policy "platform admins read billing webhook events"
  on public.bos_billing_webhook_events for select to authenticated
  using ((select private.is_bos_platform_admin()));

grant select on public.bos_billing_webhook_events to authenticated;
grant all on public.bos_billing_webhook_events to service_role;

comment on table public.bos_billing_webhook_events is
  'Idempotency and operational audit records for verified Stripe subscription webhooks; raw payment payloads are intentionally not retained.';

commit;

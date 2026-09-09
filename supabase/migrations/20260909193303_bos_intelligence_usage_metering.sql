begin;

alter table public.bos_tenant_accounts
  add column if not exists blueprint_intelligence_allowance integer not null default 0
    check (blueprint_intelligence_allowance >= 0),
  add column if not exists intelligence_price_per_credit_cents integer not null default 0
    check (intelligence_price_per_credit_cents >= 0),
  add column if not exists intelligence_spending_limit_cents integer
    check (intelligence_spending_limit_cents is null or intelligence_spending_limit_cents >= 0),
  add column if not exists intelligence_internal_non_billable boolean not null default false;

create table if not exists public.bos_intelligence_usage_ledger (
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
  entry_type text not null check (entry_type in ('allowance', 'purchase', 'usage', 'refund', 'adjustment')),
  credit_delta integer not null check (credit_delta <> 0),
  quantity integer not null default 1 check (quantity > 0),
  provider_cost_micros bigint not null default 0 check (provider_cost_micros >= 0),
  customer_charge_cents integer not null default 0 check (customer_charge_cents >= 0),
  currency text not null default 'usd' check (currency = lower(currency) and char_length(currency) = 3),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  correlation_id uuid,
  source_type text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint bos_intelligence_usage_ledger_entry_sign_check check (
    (entry_type = 'usage' and credit_delta < 0)
    or (entry_type in ('allowance', 'purchase', 'refund') and credit_delta > 0)
    or entry_type = 'adjustment'
  ),
  constraint bos_intelligence_usage_ledger_charge_check check (
    (entry_type = 'usage') or customer_charge_cents = 0
  ),
  unique (company_id, idempotency_key)
);

create index if not exists bos_intelligence_usage_ledger_company_created_idx
  on public.bos_intelligence_usage_ledger (company_id, created_at desc);
create index if not exists bos_intelligence_usage_ledger_company_product_created_idx
  on public.bos_intelligence_usage_ledger (company_id, product, created_at desc);
create index if not exists bos_intelligence_usage_ledger_correlation_idx
  on public.bos_intelligence_usage_ledger (correlation_id)
  where correlation_id is not null;

alter table public.bos_intelligence_usage_ledger enable row level security;

create policy "company billing administrators read intelligence usage"
  on public.bos_intelligence_usage_ledger for select to authenticated
  using (
    (select private.is_bos_platform_admin())
    or exists (
      select 1
      from public.company_memberships membership
      where membership.company_id = bos_intelligence_usage_ledger.company_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('owner', 'administrator')
    )
  );

create or replace function private.reject_bos_intelligence_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'B.O.S. Intelligence usage ledger entries are immutable';
end;
$$;

revoke all on function private.reject_bos_intelligence_ledger_mutation() from public;

create trigger bos_intelligence_usage_ledger_immutable
before update or delete on public.bos_intelligence_usage_ledger
for each row execute function private.reject_bos_intelligence_ledger_mutation();

grant select on public.bos_intelligence_usage_ledger to authenticated;
grant select, insert on public.bos_intelligence_usage_ledger to service_role;

comment on table public.bos_intelligence_usage_ledger is
  'Append-only credit, usage, provider-cost, customer-charge, refund, and margin evidence for Orion and Blueprint Intelligence. Failed or canceled work must not create usage entries.';

commit;

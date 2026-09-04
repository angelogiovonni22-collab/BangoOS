-- Provider-agnostic banking, reconciliation, and cash-flow forecasting foundation.
-- No provider secrets or money-movement capabilities are stored here.

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  external_connection_id text,
  institution_name text,
  institution_id text,
  status text not null default 'pending' check (status in ('pending','active','attention','disconnected','error')),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, provider, external_connection_id)
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete set null,
  provider text not null default 'manual',
  external_account_id text,
  name text not null,
  official_name text,
  mask text,
  account_type text not null default 'checking',
  account_subtype text,
  currency_code text not null default 'USD',
  current_balance numeric(14,2),
  available_balance numeric(14,2),
  balance_as_of timestamptz,
  status text not null default 'active' check (status in ('active','inactive','attention','closed')),
  include_in_cash_forecast boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, provider, external_account_id)
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  provider text not null default 'manual',
  provider_transaction_id text,
  transaction_date date not null,
  posted_at timestamptz,
  amount numeric(14,2) not null check (amount >= 0),
  direction text not null check (direction in ('credit','debit')),
  merchant_name text,
  description text not null,
  category text,
  pending boolean not null default false,
  reconciliation_status text not null default 'unmatched' check (reconciliation_status in ('unmatched','suggested','matched','excluded')),
  raw_metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, provider, provider_transaction_id)
);

create table if not exists public.bank_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  source_type text not null check (source_type in ('invoice_payment','vendor_bill_payment','project_receipt','procurement_receipt','payroll','manual_adjustment')),
  source_id uuid,
  matched_amount numeric(14,2) not null check (matched_amount > 0),
  match_status text not null default 'suggested' check (match_status in ('suggested','confirmed','rejected','voided')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  match_reason text,
  matched_by uuid references auth.users(id),
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bank_transaction_id, source_type, source_id)
);

create table if not exists public.bank_reconciliation_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  opening_balance numeric(14,2) not null,
  statement_ending_balance numeric(14,2) not null,
  reconciled_ending_balance numeric(14,2),
  difference numeric(14,2),
  status text not null default 'open' check (status in ('open','in_review','reconciled','reopened')),
  reconciled_by uuid references auth.users(id),
  reconciled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique(bank_account_id, period_start, period_end)
);

create table if not exists public.cash_flow_forecast_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  forecast_date date not null,
  direction text not null check (direction in ('inflow','outflow')),
  amount numeric(14,2) not null check (amount > 0),
  label text not null,
  project_id uuid references public.projects(id) on delete set null,
  confidence numeric(5,4) not null default 1 check (confidence >= 0 and confidence <= 1),
  status text not null default 'active' check (status in ('active','realized','cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bank_accounts_company_idx on public.bank_accounts(company_id, status);
create index if not exists bank_transactions_account_date_idx on public.bank_transactions(bank_account_id, transaction_date desc);
create index if not exists bank_transactions_company_recon_idx on public.bank_transactions(company_id, reconciliation_status, transaction_date desc);
create index if not exists bank_reconciliation_matches_transaction_idx on public.bank_reconciliation_matches(bank_transaction_id, match_status);
create index if not exists bank_reconciliation_periods_account_idx on public.bank_reconciliation_periods(bank_account_id, period_end desc);
create index if not exists cash_flow_forecast_adjustments_company_date_idx on public.cash_flow_forecast_adjustments(company_id, forecast_date);

alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.bank_reconciliation_matches enable row level security;
alter table public.bank_reconciliation_periods enable row level security;
alter table public.cash_flow_forecast_adjustments enable row level security;

-- Reuse the existing active company membership boundary for this additive finance module.
do $$
declare t text;
begin
  foreach t in array array['bank_connections','bank_accounts','bank_transactions','bank_reconciliation_matches','bank_reconciliation_periods','cash_flow_forecast_adjustments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_company_access', t);
    execute format($policy$
      create policy %I on public.%I
      for all to authenticated
      using (exists (select 1 from public.company_memberships cm where cm.company_id = %I.company_id and cm.user_id = auth.uid() and cm.status = 'active'))
      with check (exists (select 1 from public.company_memberships cm where cm.company_id = %I.company_id and cm.user_id = auth.uid() and cm.status = 'active'))
    $policy$, t || '_company_access', t, t, t);
  end loop;
end $$;

create or replace function public.sync_bank_transaction_reconciliation_status_fn()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_transaction_id uuid; v_status text;
begin
  v_transaction_id := coalesce(new.bank_transaction_id, old.bank_transaction_id);
  select case
    when exists(select 1 from public.bank_reconciliation_matches m where m.bank_transaction_id=v_transaction_id and m.match_status='confirmed') then 'matched'
    when exists(select 1 from public.bank_reconciliation_matches m where m.bank_transaction_id=v_transaction_id and m.match_status='suggested') then 'suggested'
    else 'unmatched' end into v_status;
  update public.bank_transactions set reconciliation_status=v_status, updated_at=now() where id=v_transaction_id and reconciliation_status <> 'excluded';
  return coalesce(new, old);
end $$;

revoke execute on function public.sync_bank_transaction_reconciliation_status_fn() from public, anon, authenticated;
grant execute on function public.sync_bank_transaction_reconciliation_status_fn() to service_role;

drop trigger if exists sync_bank_transaction_reconciliation_status on public.bank_reconciliation_matches;
create trigger sync_bank_transaction_reconciliation_status
after insert or update or delete on public.bank_reconciliation_matches
for each row execute function public.sync_bank_transaction_reconciliation_status_fn();

comment on table public.bank_connections is 'Provider-agnostic bank connection metadata only. Provider credentials/tokens are never stored in this table.';
comment on table public.bank_transactions is 'Read-only imported/manual bank ledger for reconciliation. It does not initiate money movement.';
comment on table public.bank_reconciliation_matches is 'Auditable links between bank transactions and existing B.O.S. finance source records.';

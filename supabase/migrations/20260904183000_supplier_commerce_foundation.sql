-- Provider-neutral retailer integration foundation.
-- Secrets stay in deployment secret storage and are never persisted in these tables.

create table if not exists public.supplier_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  provider text not null,
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  status text not null default 'configuration_required' check (status in ('configuration_required','ready','attention','disabled')),
  external_account_reference text,
  capabilities jsonb not null default '{}'::jsonb,
  configuration_metadata jsonb not null default '{}'::jsonb,
  last_catalog_sync_at timestamptz,
  last_inventory_sync_at timestamptz,
  last_order_sync_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, provider, environment)
);

create table if not exists public.supplier_product_quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  integration_id uuid references public.supplier_integrations(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  material_id uuid references public.materials(id) on delete set null,
  provider text not null,
  supplier_sku text not null,
  product_name text,
  store_id text,
  zip_code text,
  unit_price numeric(14,4),
  contractor_price numeric(14,4),
  stock_quantity numeric(14,4),
  availability text,
  product_url text,
  response_metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_order_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  integration_id uuid references public.supplier_integrations(id) on delete restrict,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  vendor_id uuid references public.vendors(id) on delete set null,
  provider text not null,
  environment text not null default 'sandbox' check (environment in ('sandbox','production')),
  idempotency_key text not null,
  status text not null default 'ready' check (status in ('ready','submitting','submitted','confirmed','attention','failed','cancelled')),
  external_order_id text,
  external_order_reference text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  last_status_sync_at timestamptz,
  sanitized_request jsonb not null default '{}'::jsonb,
  response_metadata jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, provider, idempotency_key),
  unique(purchase_order_id, provider, environment)
);

create table if not exists public.supplier_order_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  submission_id uuid not null references public.supplier_order_submissions(id) on delete cascade,
  provider text not null,
  external_event_id text,
  event_type text not null,
  event_status text,
  sanitized_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  unique(provider, external_event_id)
);

create index if not exists supplier_integrations_company_idx on public.supplier_integrations(company_id, status);
create index if not exists supplier_product_quotes_lookup_idx on public.supplier_product_quotes(company_id, provider, supplier_sku, observed_at desc);
create index if not exists supplier_product_quotes_material_idx on public.supplier_product_quotes(company_id, material_id, observed_at desc);
create index if not exists supplier_order_submissions_company_status_idx on public.supplier_order_submissions(company_id, status, created_at desc);
create index if not exists supplier_order_events_submission_idx on public.supplier_order_events(submission_id, received_at desc);

alter table public.supplier_integrations enable row level security;
alter table public.supplier_product_quotes enable row level security;
alter table public.supplier_order_submissions enable row level security;
alter table public.supplier_order_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['supplier_integrations','supplier_product_quotes','supplier_order_submissions','supplier_order_events'] loop
    execute format('drop policy if exists %I on public.%I', t || '_company_access', t);
    execute format($policy$
      create policy %I on public.%I
      for all to authenticated
      using (exists (select 1 from public.company_memberships cm where cm.company_id = %I.company_id and cm.user_id = auth.uid() and cm.status = 'active'))
      with check (exists (select 1 from public.company_memberships cm where cm.company_id = %I.company_id and cm.user_id = auth.uid() and cm.status = 'active'))
    $policy$, t || '_company_access', t, t, t);
  end loop;
end $$;

comment on table public.supplier_integrations is 'Non-secret supplier integration state. Credentials remain in deployment secret storage.';
comment on table public.supplier_product_quotes is 'Short-lived provider quote/inventory observations used to compare live supplier pricing.';
comment on table public.supplier_order_submissions is 'Auditable outbound supplier order lifecycle. Rows do not themselves move money.';

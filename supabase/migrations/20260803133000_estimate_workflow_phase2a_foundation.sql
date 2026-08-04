begin;

-- Ensure parent tables expose the composite keys needed for company-scoped relationships.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'estimates_id_company_unique'
  ) then
    alter table public.estimates
      add constraint estimates_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'projects_id_company_unique'
  ) then
    alter table public.projects
      add constraint projects_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'invoices_id_company_unique'
  ) then
    alter table public.invoices
      add constraint invoices_id_company_unique unique (id, company_id);
  end if;
end $$;

alter table public.estimates
  add column if not exists agreement_version_id uuid null,
  add column if not exists agreement_snapshot jsonb null,
  add column if not exists agreement_hash text null,
  add column if not exists approval_signature_id uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists declined_at timestamptz null,
  add column if not exists decline_reason text null,
  add column if not exists revision_requested_at timestamptz null,
  add column if not exists revision_request_notes text null,
  add column if not exists followup_due_at timestamptz null,
  add column if not exists conversion_state text not null default 'not_started',
  add column if not exists converted_project_id uuid null,
  add column if not exists converted_at timestamptz null,
  add column if not exists deposit_type text not null default 'none',
  add column if not exists deposit_value numeric(14,2) not null default 0,
  add column if not exists deposit_amount numeric(14,2) not null default 0,
  add column if not exists deposit_invoice_id uuid null,
  add column if not exists public_token_last_issued_at timestamptz null;

alter table public.estimates
  drop constraint if exists estimates_agreement_hash_not_blank_check,
  add constraint estimates_agreement_hash_not_blank_check
    check (agreement_hash is null or btrim(agreement_hash) <> '')
    not valid;

alter table public.estimates
  drop constraint if exists estimates_conversion_state_check,
  add constraint estimates_conversion_state_check
    check (conversion_state in ('not_started', 'in_progress', 'converted', 'failed'))
    not valid;

alter table public.estimates
  drop constraint if exists estimates_deposit_type_check,
  add constraint estimates_deposit_type_check
    check (deposit_type in ('none', 'fixed', 'percentage'))
    not valid;

alter table public.estimates
  drop constraint if exists estimates_deposit_value_check,
  add constraint estimates_deposit_value_check
    check (deposit_value >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_deposit_amount_check,
  add constraint estimates_deposit_amount_check
    check (deposit_amount >= 0)
    not valid;

create index if not exists idx_estimates_company_conversion_state
  on public.estimates(company_id, conversion_state);

create index if not exists idx_estimates_company_followup_due_at
  on public.estimates(company_id, followup_due_at)
  where followup_due_at is not null;

create index if not exists idx_estimates_company_approved_at
  on public.estimates(company_id, approved_at)
  where approved_at is not null;

create table if not exists public.estimate_public_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  revoked_by uuid null,
  issued_by uuid null,
  last_viewed_at timestamptz null,
  view_count integer not null default 0,
  last_viewed_ip text null,
  last_viewed_user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint estimate_public_tokens_token_hash_not_blank_check
    check (btrim(token_hash) <> ''),

  constraint estimate_public_tokens_view_count_check
    check (view_count >= 0),

  constraint estimate_public_tokens_expiration_window_check
    check (expires_at > created_at),

  constraint estimate_public_tokens_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade,

  constraint estimate_public_tokens_revoked_by_company_fkey
    foreign key (revoked_by, company_id)
    references public.profiles(id, company_id)
    on delete set null,

  constraint estimate_public_tokens_issued_by_company_fkey
    foreign key (issued_by, company_id)
    references public.profiles(id, company_id)
    on delete set null
);

alter table public.estimate_public_tokens
  drop constraint if exists estimate_public_tokens_company_estimate_hash_unique,
  add constraint estimate_public_tokens_company_estimate_hash_unique
    unique (company_id, estimate_id, token_hash);

alter table public.estimate_public_tokens
  drop constraint if exists estimate_public_tokens_company_hash_unique,
  add constraint estimate_public_tokens_company_hash_unique
    unique (company_id, token_hash);

create index if not exists idx_estimate_public_tokens_company_estimate
  on public.estimate_public_tokens(company_id, estimate_id);

create index if not exists idx_estimate_public_tokens_company_expires_at
  on public.estimate_public_tokens(company_id, expires_at);

create index if not exists idx_estimate_public_tokens_company_revoked_at
  on public.estimate_public_tokens(company_id, revoked_at);

create table if not exists public.estimate_agreement_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null,
  version_number integer not null,
  agreement_snapshot jsonb not null,
  agreement_hash text not null,
  source_terms text null,
  source_payment_terms text null,
  created_by uuid null,
  created_at timestamptz not null default now(),

  constraint estimate_agreement_versions_version_number_check
    check (version_number >= 1),

  constraint estimate_agreement_versions_hash_not_blank_check
    check (btrim(agreement_hash) <> ''),

  constraint estimate_agreement_versions_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade,

  constraint estimate_agreement_versions_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null
);

alter table public.estimate_agreement_versions
  drop constraint if exists estimate_agreement_versions_company_estimate_version_unique,
  add constraint estimate_agreement_versions_company_estimate_version_unique
    unique (company_id, estimate_id, version_number);

alter table public.estimate_agreement_versions
  drop constraint if exists estimate_agreement_versions_company_estimate_hash_unique,
  add constraint estimate_agreement_versions_company_estimate_hash_unique
    unique (company_id, estimate_id, agreement_hash);

create index if not exists idx_estimate_agreement_versions_company_estimate
  on public.estimate_agreement_versions(company_id, estimate_id, created_at desc);

create table if not exists public.estimate_signatures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null,
  agreement_version_id uuid not null,
  public_token_id uuid null,
  estimate_version_number integer not null,
  typed_name text not null,
  consent_accepted boolean not null,
  signed_at timestamptz not null default now(),
  ip_address text null,
  user_agent text null,
  verification_result text not null default 'not_available',
  signature_hash text not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint estimate_signatures_typed_name_not_blank_check
    check (btrim(typed_name) <> ''),

  constraint estimate_signatures_consent_must_be_true_check
    check (consent_accepted),

  constraint estimate_signatures_estimate_version_number_check
    check (estimate_version_number >= 1),

  constraint estimate_signatures_verification_result_check
    check (verification_result in ('verified', 'unverified', 'failed', 'not_available')),

  constraint estimate_signatures_signature_hash_not_blank_check
    check (btrim(signature_hash) <> ''),

  constraint estimate_signatures_idempotency_key_not_blank_check
    check (btrim(idempotency_key) <> ''),

  constraint estimate_signatures_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade,

  constraint estimate_signatures_agreement_company_fkey
    foreign key (agreement_version_id, company_id)
    references public.estimate_agreement_versions(id, company_id)
    on delete restrict,

  constraint estimate_signatures_public_token_company_fkey
    foreign key (public_token_id, company_id)
    references public.estimate_public_tokens(id, company_id)
    on delete set null
);

alter table public.estimate_signatures
  drop constraint if exists estimate_signatures_company_estimate_idempotency_unique,
  add constraint estimate_signatures_company_estimate_idempotency_unique
    unique (company_id, estimate_id, idempotency_key);

alter table public.estimate_signatures
  drop constraint if exists estimate_signatures_company_estimate_signature_hash_unique,
  add constraint estimate_signatures_company_estimate_signature_hash_unique
    unique (company_id, estimate_id, signature_hash);

create index if not exists idx_estimate_signatures_company_estimate_signed_at
  on public.estimate_signatures(company_id, estimate_id, signed_at desc);

create index if not exists idx_estimate_signatures_company_token
  on public.estimate_signatures(company_id, public_token_id)
  where public_token_id is not null;

create table if not exists public.estimate_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null,
  signature_id uuid null,
  event_type text not null,
  actor_type text not null,
  actor_profile_id uuid null,
  reason text null,
  idempotency_key text null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint estimate_acceptance_events_event_type_check
    check (event_type in ('approved', 'declined', 'request_changes', 'sent', 'viewed', 'followup_due', 'converted')),

  constraint estimate_acceptance_events_actor_type_check
    check (actor_type in ('customer', 'internal', 'system')),

  constraint estimate_acceptance_events_idempotency_key_not_blank_check
    check (idempotency_key is null or btrim(idempotency_key) <> ''),

  constraint estimate_acceptance_events_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade,

  constraint estimate_acceptance_events_signature_company_fkey
    foreign key (signature_id, company_id)
    references public.estimate_signatures(id, company_id)
    on delete set null,

  constraint estimate_acceptance_events_actor_profile_company_fkey
    foreign key (actor_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null
);

create unique index if not exists idx_estimate_acceptance_events_company_estimate_idempotency
  on public.estimate_acceptance_events(company_id, estimate_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_estimate_acceptance_events_company_estimate_occurred_at
  on public.estimate_acceptance_events(company_id, estimate_id, occurred_at desc);

create table if not exists public.estimate_project_conversions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null,
  project_id uuid null,
  deposit_invoice_id uuid null,
  idempotency_key text not null,
  status text not null default 'started',
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  converted_by uuid null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),

  constraint estimate_project_conversions_idempotency_key_not_blank_check
    check (btrim(idempotency_key) <> ''),

  constraint estimate_project_conversions_status_check
    check (status in ('started', 'completed', 'failed')),

  constraint estimate_project_conversions_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade,

  constraint estimate_project_conversions_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete set null,

  constraint estimate_project_conversions_invoice_company_fkey
    foreign key (deposit_invoice_id, company_id)
    references public.invoices(id, company_id)
    on delete set null,

  constraint estimate_project_conversions_converted_by_company_fkey
    foreign key (converted_by, company_id)
    references public.profiles(id, company_id)
    on delete set null
);

alter table public.estimate_project_conversions
  drop constraint if exists estimate_project_conversions_company_estimate_unique,
  add constraint estimate_project_conversions_company_estimate_unique
    unique (company_id, estimate_id);

alter table public.estimate_project_conversions
  drop constraint if exists estimate_project_conversions_company_idempotency_unique,
  add constraint estimate_project_conversions_company_idempotency_unique
    unique (company_id, idempotency_key);

create index if not exists idx_estimate_project_conversions_company_status
  on public.estimate_project_conversions(company_id, status, created_at desc);

create table if not exists public.company_project_sequences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  prefix text not null default 'PRJ-',
  padding integer not null default 4,
  next_number bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_project_sequences_prefix_not_blank_check
    check (btrim(prefix) <> ''),

  constraint company_project_sequences_padding_check
    check (padding between 1 and 12),

  constraint company_project_sequences_next_number_check
    check (next_number >= 1)
);

alter table public.company_project_sequences enable row level security;

drop policy if exists company_project_sequences_select on public.company_project_sequences;
drop policy if exists company_project_sequences_insert on public.company_project_sequences;
drop policy if exists company_project_sequences_update on public.company_project_sequences;

-- Project sequence rows are intentionally not directly readable/writable by clients.

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  workflow_name text not null,
  event_type text not null,
  current_state text null,
  next_state text null,
  actor_profile_id uuid null,
  reference_entity text not null,
  reference_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint workflow_events_workflow_name_not_blank_check
    check (btrim(workflow_name) <> ''),

  constraint workflow_events_event_type_not_blank_check
    check (btrim(event_type) <> ''),

  constraint workflow_events_reference_entity_not_blank_check
    check (btrim(reference_entity) <> ''),

  constraint workflow_events_actor_profile_company_fkey
    foreign key (actor_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null
);

create index if not exists idx_workflow_events_company_occurred_at
  on public.workflow_events(company_id, occurred_at desc);

create index if not exists idx_workflow_events_company_workflow
  on public.workflow_events(company_id, workflow_name, occurred_at desc);

create index if not exists idx_workflow_events_company_reference
  on public.workflow_events(company_id, reference_entity, reference_id, occurred_at desc);

create index if not exists idx_workflow_events_company_event_type
  on public.workflow_events(company_id, event_type, occurred_at desc);

-- Enforce immutable agreement/signature references from estimates.
alter table public.estimates
  drop constraint if exists estimates_agreement_version_company_fkey,
  add constraint estimates_agreement_version_company_fkey
    foreign key (agreement_version_id, company_id)
    references public.estimate_agreement_versions(id, company_id)
    on delete set null;

alter table public.estimates
  drop constraint if exists estimates_approval_signature_company_fkey,
  add constraint estimates_approval_signature_company_fkey
    foreign key (approval_signature_id, company_id)
    references public.estimate_signatures(id, company_id)
    on delete set null;

alter table public.estimates
  drop constraint if exists estimates_converted_project_company_fkey,
  add constraint estimates_converted_project_company_fkey
    foreign key (converted_project_id, company_id)
    references public.projects(id, company_id)
    on delete set null;

alter table public.estimates
  drop constraint if exists estimates_deposit_invoice_company_fkey,
  add constraint estimates_deposit_invoice_company_fkey
    foreign key (deposit_invoice_id, company_id)
    references public.invoices(id, company_id)
    on delete set null;

create or replace function public.calculate_deposit_amount(
  p_deposit_type text,
  p_deposit_value numeric,
  p_total_amount numeric
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_type text := coalesce(p_deposit_type, 'none');
  v_value numeric := coalesce(p_deposit_value, 0);
  v_total numeric := greatest(coalesce(p_total_amount, 0), 0);
begin
  if v_type = 'percentage' then
    return round(greatest(v_total * (v_value / 100.0), 0), 2);
  end if;

  if v_type = 'fixed' then
    return round(least(greatest(v_value, 0), v_total), 2);
  end if;

  return 0;
end;
$$;

create or replace function public.calculate_estimate_deposit(p_company_id uuid, p_estimate_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deposit numeric := 0;
begin
  if p_company_id is null or p_estimate_id is null then
    raise exception 'Company id and estimate id are required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = p_company_id
  ) then
    raise exception 'Not authorized for company %', p_company_id;
  end if;

  select public.calculate_deposit_amount(e.deposit_type, e.deposit_value, e.total_amount)
    into v_deposit
  from public.estimates e
  where e.company_id = p_company_id
    and e.id = p_estimate_id;

  if v_deposit is null then
    raise exception 'Estimate % was not found for company %', p_estimate_id, p_company_id;
  end if;

  return v_deposit;
end;
$$;

create or replace function public.allocate_project_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocated bigint;
  v_prefix text;
  v_padding integer;
begin
  if p_company_id is null then
    raise exception 'Company id is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = p_company_id
  ) then
    raise exception 'Not authorized for company %', p_company_id;
  end if;

  with upserted as (
    insert into public.company_project_sequences (company_id, prefix, padding, next_number)
    values (p_company_id, 'PRJ-', 4, 2)
    on conflict (company_id)
    do update
      set next_number = public.company_project_sequences.next_number + 1,
          updated_at = now()
    returning next_number, prefix, padding
  )
  select next_number - 1, prefix, padding
    into v_allocated, v_prefix, v_padding
  from upserted;

  return v_prefix || lpad(v_allocated::text, v_padding, '0');
end;
$$;

create or replace function public.validate_estimate_public_token(
  p_token text,
  p_ip_address text default null,
  p_user_agent text default null
)
returns table (
  token_id uuid,
  company_id uuid,
  estimate_id uuid,
  expires_at timestamptz,
  is_valid boolean,
  failure_reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token_hash text;
  v_row public.estimate_public_tokens%rowtype;
begin
  if p_token is null or btrim(p_token) = '' then
    return query select null::uuid, null::uuid, null::uuid, null::timestamptz, false, 'token_missing'::text;
    return;
  end if;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  select *
    into v_row
  from public.estimate_public_tokens t
  where t.token_hash = v_token_hash
  limit 1;

  if not found then
    return query select null::uuid, null::uuid, null::uuid, null::timestamptz, false, 'token_not_found'::text;
    return;
  end if;

  if v_row.revoked_at is not null then
    return query select v_row.id, v_row.company_id, v_row.estimate_id, v_row.expires_at, false, 'token_revoked'::text;
    return;
  end if;

  if v_row.expires_at <= now() then
    return query select v_row.id, v_row.company_id, v_row.estimate_id, v_row.expires_at, false, 'token_expired'::text;
    return;
  end if;

  update public.estimate_public_tokens
     set view_count = view_count + 1,
         last_viewed_at = now(),
         last_viewed_ip = coalesce(p_ip_address, last_viewed_ip),
         last_viewed_user_agent = coalesce(p_user_agent, last_viewed_user_agent),
         updated_at = now()
   where id = v_row.id;

  return query select v_row.id, v_row.company_id, v_row.estimate_id, v_row.expires_at, true, null::text;
end;
$$;

create or replace function public.convert_estimate_to_project(
  p_company_id uuid,
  p_estimate_id uuid,
  p_actor_profile_id uuid,
  p_idempotency_key text,
  p_create_deposit_invoice boolean default true
)
returns table (
  conversion_id uuid,
  project_id uuid,
  project_number text,
  deposit_invoice_id uuid,
  conversion_status text,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estimate public.estimates%rowtype;
  v_existing public.estimate_project_conversions%rowtype;
  v_project_id uuid;
  v_project_number text;
  v_conversion_id uuid;
  v_deposit_amount numeric := 0;
  v_deposit_invoice_id uuid := null;
begin
  if p_company_id is null or p_estimate_id is null or p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'Company id, estimate id, and idempotency key are required';
  end if;

  if p_actor_profile_id is null then
    p_actor_profile_id := auth.uid();
  end if;

  if p_actor_profile_id is null then
    raise exception 'Authenticated profile is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_profile_id
      and p.company_id = p_company_id
      and p.id = auth.uid()
  ) then
    raise exception 'Not authorized for company %', p_company_id;
  end if;

  select *
    into v_existing
  from public.estimate_project_conversions c
  where c.company_id = p_company_id
    and c.idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return query
      select v_existing.id, v_existing.project_id, pr.project_number, v_existing.deposit_invoice_id, v_existing.status, true
      from public.projects pr
      where pr.id = v_existing.project_id
        and pr.company_id = p_company_id
      union all
      select v_existing.id, v_existing.project_id, null::text, v_existing.deposit_invoice_id, v_existing.status, true
      where v_existing.project_id is null
      limit 1;
    return;
  end if;

  select *
    into v_existing
  from public.estimate_project_conversions c
  where c.company_id = p_company_id
    and c.estimate_id = p_estimate_id
    and c.status = 'completed'
  limit 1;

  if found then
    return query
      select v_existing.id, v_existing.project_id, pr.project_number, v_existing.deposit_invoice_id, v_existing.status, true
      from public.projects pr
      where pr.id = v_existing.project_id
        and pr.company_id = p_company_id
      union all
      select v_existing.id, v_existing.project_id, null::text, v_existing.deposit_invoice_id, v_existing.status, true
      where v_existing.project_id is null
      limit 1;
    return;
  end if;

  select *
    into v_estimate
  from public.estimates e
  where e.company_id = p_company_id
    and e.id = p_estimate_id
  for update;

  if not found then
    raise exception 'Estimate % was not found for company %', p_estimate_id, p_company_id;
  end if;

  if v_estimate.status <> 'approved' then
    raise exception 'Estimate % must be approved before conversion', p_estimate_id;
  end if;

  if v_estimate.project_id is not null then
    v_project_id := v_estimate.project_id;
    select p.project_number
      into v_project_number
    from public.projects p
    where p.id = v_project_id
      and p.company_id = p_company_id;
  else
    v_project_number := public.allocate_project_number(p_company_id);

    insert into public.projects (
      company_id,
      customer_id,
      name,
      project_number,
      status,
      description,
      contract_amount,
      estimated_cost,
      created_by
    )
    values (
      p_company_id,
      v_estimate.customer_id,
      case
        when btrim(coalesce(v_estimate.title, '')) = '' then 'Converted Project'
        else v_estimate.title
      end,
      v_project_number,
      'approved',
      v_estimate.description,
      v_estimate.total_amount,
      v_estimate.direct_cost_subtotal,
      p_actor_profile_id
    )
    returning id into v_project_id;
  end if;

  insert into public.estimate_project_conversions (
    company_id,
    estimate_id,
    project_id,
    idempotency_key,
    status,
    converted_by,
    metadata,
    completed_at,
    updated_at
  )
  values (
    p_company_id,
    p_estimate_id,
    v_project_id,
    p_idempotency_key,
    'started',
    p_actor_profile_id,
    jsonb_build_object(
      'source', 'convert_estimate_to_project',
      'estimate_status', v_estimate.status,
      'estimate_version', v_estimate.version_number
    ),
    null,
    now()
  )
  on conflict (company_id, estimate_id)
  do update
    set updated_at = now()
  returning id into v_conversion_id;

  v_deposit_amount := public.calculate_deposit_amount(v_estimate.deposit_type, v_estimate.deposit_value, v_estimate.total_amount);

  if p_create_deposit_invoice and v_deposit_amount > 0 then
    insert into public.invoices (
      company_id,
      title,
      customer_id,
      project_id,
      estimate_id,
      issue_date,
      due_date,
      status,
      description,
      subtotal,
      discount_type,
      discount_value,
      discount_total,
      tax_rate,
      tax_amount,
      additional_fee,
      total_amount,
      amount_paid,
      notes,
      payment_terms,
      created_by,
      updated_by
    )
    values (
      p_company_id,
      concat('Deposit - ', coalesce(v_estimate.title, 'Estimate')),
      v_estimate.customer_id,
      v_project_id,
      v_estimate.id,
      current_date,
      (current_date + interval '7 day')::date,
      'draft',
      'Auto-generated deposit invoice from estimate conversion.',
      v_deposit_amount,
      'none',
      0,
      0,
      0,
      0,
      0,
      v_deposit_amount,
      0,
      'Created during estimate conversion.',
      v_estimate.payment_terms,
      p_actor_profile_id,
      p_actor_profile_id
    )
    returning id into v_deposit_invoice_id;

    insert into public.invoice_estimate_links (
      company_id,
      invoice_id,
      estimate_id,
      link_type,
      created_by,
      metadata
    )
    values (
      p_company_id,
      v_deposit_invoice_id,
      p_estimate_id,
      'converted',
      p_actor_profile_id,
      jsonb_build_object('kind', 'deposit', 'conversion_id', v_conversion_id)
    )
    on conflict (invoice_id, estimate_id)
    do nothing;
  end if;

  update public.estimates
     set project_id = coalesce(project_id, v_project_id),
         conversion_state = 'converted',
         converted_project_id = v_project_id,
         converted_at = now(),
         deposit_amount = v_deposit_amount,
         deposit_invoice_id = coalesce(v_deposit_invoice_id, deposit_invoice_id),
         updated_by = p_actor_profile_id,
         updated_at = now()
   where id = p_estimate_id
     and company_id = p_company_id;

  update public.estimate_project_conversions
     set project_id = v_project_id,
         deposit_invoice_id = v_deposit_invoice_id,
         status = 'completed',
         completed_at = now(),
         updated_at = now(),
         metadata = metadata || jsonb_build_object('deposit_amount', v_deposit_amount)
   where id = v_conversion_id;

  insert into public.estimate_acceptance_events (
    company_id,
    estimate_id,
    event_type,
    actor_type,
    actor_profile_id,
    metadata
  )
  values (
    p_company_id,
    p_estimate_id,
    'converted',
    'internal',
    p_actor_profile_id,
    jsonb_build_object('project_id', v_project_id, 'conversion_id', v_conversion_id)
  );

  insert into public.workflow_events (
    company_id,
    workflow_name,
    event_type,
    current_state,
    next_state,
    actor_profile_id,
    reference_entity,
    reference_id,
    metadata
  )
  values
    (
      p_company_id,
      'estimate_lifecycle',
      'estimate.converted',
      v_estimate.status,
      'converted',
      p_actor_profile_id,
      'estimate',
      p_estimate_id,
      jsonb_build_object('project_id', v_project_id, 'conversion_id', v_conversion_id)
    ),
    (
      p_company_id,
      'project_lifecycle',
      'project.created',
      null,
      'approved',
      p_actor_profile_id,
      'project',
      v_project_id,
      jsonb_build_object('estimate_id', p_estimate_id, 'conversion_id', v_conversion_id)
    ),
    (
      p_company_id,
      'project_lifecycle',
      'project.ready_for_scheduling',
      'approved',
      'ready_for_scheduling',
      p_actor_profile_id,
      'project',
      v_project_id,
      jsonb_build_object('estimate_id', p_estimate_id, 'conversion_id', v_conversion_id)
    );

  if v_deposit_invoice_id is not null then
    insert into public.workflow_events (
      company_id,
      workflow_name,
      event_type,
      current_state,
      next_state,
      actor_profile_id,
      reference_entity,
      reference_id,
      metadata
    )
    values (
      p_company_id,
      'deposit_lifecycle',
      'deposit.created',
      null,
      'draft',
      p_actor_profile_id,
      'invoice',
      v_deposit_invoice_id,
      jsonb_build_object('estimate_id', p_estimate_id, 'project_id', v_project_id)
    );
  end if;

  return query
    select v_conversion_id, v_project_id, v_project_number, v_deposit_invoice_id, 'completed'::text, false;
end;
$$;

alter table public.estimate_public_tokens enable row level security;
alter table public.estimate_agreement_versions enable row level security;
alter table public.estimate_signatures enable row level security;
alter table public.estimate_acceptance_events enable row level security;
alter table public.estimate_project_conversions enable row level security;
alter table public.workflow_events enable row level security;

drop policy if exists estimate_public_tokens_select on public.estimate_public_tokens;
drop policy if exists estimate_public_tokens_insert on public.estimate_public_tokens;
drop policy if exists estimate_public_tokens_update on public.estimate_public_tokens;

create policy estimate_public_tokens_select
on public.estimate_public_tokens
for select
to authenticated
using (
  public.is_company_member(estimate_public_tokens.company_id)
);

create policy estimate_public_tokens_insert
on public.estimate_public_tokens
for insert
to authenticated
with check (
  public.has_company_role(
    estimate_public_tokens.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (
    estimate_public_tokens.issued_by is null
    or estimate_public_tokens.issued_by = auth.uid()
  )
);

create policy estimate_public_tokens_update
on public.estimate_public_tokens
for update
to authenticated
using (
  public.has_company_role(
    estimate_public_tokens.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
)
with check (
  public.has_company_role(
    estimate_public_tokens.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (
    estimate_public_tokens.revoked_by is null
    or estimate_public_tokens.revoked_by = auth.uid()
  )
);

drop policy if exists estimate_agreement_versions_select on public.estimate_agreement_versions;
drop policy if exists estimate_agreement_versions_insert on public.estimate_agreement_versions;

create policy estimate_agreement_versions_select
on public.estimate_agreement_versions
for select
to authenticated
using (
  public.is_company_member(estimate_agreement_versions.company_id)
);

create policy estimate_agreement_versions_insert
on public.estimate_agreement_versions
for insert
to authenticated
with check (
  public.has_company_role(
    estimate_agreement_versions.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (
    estimate_agreement_versions.created_by is null
    or estimate_agreement_versions.created_by = auth.uid()
  )
);

drop policy if exists estimate_signatures_select on public.estimate_signatures;
drop policy if exists estimate_signatures_insert on public.estimate_signatures;

create policy estimate_signatures_select
on public.estimate_signatures
for select
to authenticated
using (
  public.is_company_member(estimate_signatures.company_id)
);

create policy estimate_signatures_insert
on public.estimate_signatures
for insert
to authenticated
with check (
  public.has_company_role(
    estimate_signatures.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
);

drop policy if exists estimate_acceptance_events_select on public.estimate_acceptance_events;
drop policy if exists estimate_acceptance_events_insert on public.estimate_acceptance_events;

create policy estimate_acceptance_events_select
on public.estimate_acceptance_events
for select
to authenticated
using (
  public.is_company_member(estimate_acceptance_events.company_id)
);

create policy estimate_acceptance_events_insert
on public.estimate_acceptance_events
for insert
to authenticated
with check (
  public.has_company_role(
    estimate_acceptance_events.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (
    estimate_acceptance_events.actor_profile_id is null
    or estimate_acceptance_events.actor_profile_id = auth.uid()
  )
);

drop policy if exists estimate_project_conversions_select on public.estimate_project_conversions;
drop policy if exists estimate_project_conversions_insert on public.estimate_project_conversions;

create policy estimate_project_conversions_select
on public.estimate_project_conversions
for select
to authenticated
using (
  public.is_company_member(estimate_project_conversions.company_id)
);

create policy estimate_project_conversions_insert
on public.estimate_project_conversions
for insert
to authenticated
with check (
  public.has_company_role(
    estimate_project_conversions.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (
    estimate_project_conversions.converted_by is null
    or estimate_project_conversions.converted_by = auth.uid()
  )
);

drop policy if exists workflow_events_select on public.workflow_events;
drop policy if exists workflow_events_insert on public.workflow_events;

create policy workflow_events_select
on public.workflow_events
for select
to authenticated
using (
  public.is_company_member(workflow_events.company_id)
);

create policy workflow_events_insert
on public.workflow_events
for insert
to authenticated
with check (
  public.has_company_role(
    workflow_events.company_id,
    array['owner', 'administrator', 'operations_manager', 'project_manager', 'superintendent', 'foreman', 'office_manager']
  )
  and (
    workflow_events.actor_profile_id is null
    or workflow_events.actor_profile_id = auth.uid()
  )
);

grant execute on function public.validate_estimate_public_token(text, text, text) to anon, authenticated;
grant execute on function public.calculate_estimate_deposit(uuid, uuid) to authenticated;
grant execute on function public.allocate_project_number(uuid) to authenticated;
grant execute on function public.convert_estimate_to_project(uuid, uuid, uuid, text, boolean) to authenticated;

commit;

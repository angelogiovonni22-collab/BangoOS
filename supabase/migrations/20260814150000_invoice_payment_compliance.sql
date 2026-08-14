create table if not exists public.invoice_payment_compliance_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null,
  estimate_id uuid not null,
  ruleset_id text not null,
  ruleset_version text not null,
  jurisdiction text not null,
  status text not null,
  applicable boolean,
  requested_amount numeric(14,2) not null,
  prospective_preperformance_payments numeric(14,2) not null,
  maximum_preperformance_payment numeric(14,2) not null,
  evaluation jsonb not null,
  evaluated_by uuid,
  created_at timestamptz not null default now(),
  constraint invoice_payment_compliance_status_check check (status in ('COMPLIANT','ACTION_REQUIRED','REVIEW_REQUIRED','NOT_APPLICABLE')),
  constraint invoice_payment_compliance_requested_amount_check check (requested_amount >= 0),
  constraint invoice_payment_compliance_prospective_check check (prospective_preperformance_payments >= 0),
  constraint invoice_payment_compliance_maximum_check check (maximum_preperformance_payment >= 0),
  constraint invoice_payment_compliance_invoice_company_fkey foreign key (invoice_id, company_id) references public.invoices(id, company_id) on delete cascade,
  constraint invoice_payment_compliance_estimate_company_fkey foreign key (estimate_id, company_id) references public.estimates(id, company_id) on delete cascade
);

create index if not exists invoice_payment_compliance_lookup_idx
  on public.invoice_payment_compliance_evaluations(company_id, invoice_id, created_at desc);

alter table public.invoice_payment_compliance_evaluations enable row level security;

create policy "invoice_payment_compliance_active_company_members_read"
on public.invoice_payment_compliance_evaluations
for select
to authenticated
using (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = invoice_payment_compliance_evaluations.company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
));

create policy "invoice_payment_compliance_active_company_members_insert"
on public.invoice_payment_compliance_evaluations
for insert
to authenticated
with check (exists (
  select 1 from public.company_memberships cm
  where cm.company_id = invoice_payment_compliance_evaluations.company_id
    and cm.user_id = auth.uid()
    and cm.status = 'active'
));

-- Intentionally no update/delete policies: compliance decisions are append-only evidence.

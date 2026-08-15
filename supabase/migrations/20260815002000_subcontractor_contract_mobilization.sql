-- B.O.S. subcontractor agreement + mobilization foundation

create table if not exists public.subcontractor_master_agreements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','sent','signed','void','expired')),
  agreement_version text not null,
  agreement_snapshot jsonb not null default '{}'::jsonb,
  agreement_hash text not null,
  signer_name text,
  signer_title text,
  signer_email text,
  signed_at timestamptz,
  public_token_hash text,
  token_expires_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcontractor_master_agreements_company_vendor_idx
  on public.subcontractor_master_agreements(company_id, vendor_id, created_at desc);
create unique index if not exists subcontractor_master_agreements_token_hash_idx
  on public.subcontractor_master_agreements(public_token_hash) where public_token_hash is not null;

create table if not exists public.project_subcontract_work_authorizations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.trade_partner_assignments(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  master_agreement_id uuid references public.subcontractor_master_agreements(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','signed','void','expired')),
  authorization_version text not null,
  authorization_snapshot jsonb not null default '{}'::jsonb,
  authorization_hash text not null,
  scope_of_work text,
  contract_amount numeric(14,2),
  payment_terms text,
  retainage_percent numeric(7,4),
  start_date date,
  target_completion_date date,
  signer_name text,
  signer_title text,
  signer_email text,
  signed_at timestamptz,
  public_token_hash text,
  token_expires_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, assignment_id)
);

create index if not exists project_subcontract_work_authorizations_project_idx
  on public.project_subcontract_work_authorizations(company_id, project_id, created_at desc);
create unique index if not exists project_subcontract_work_authorizations_token_hash_idx
  on public.project_subcontract_work_authorizations(public_token_hash) where public_token_hash is not null;

create table if not exists public.subcontractor_signature_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  assignment_id uuid references public.trade_partner_assignments(id) on delete cascade,
  master_agreement_id uuid references public.subcontractor_master_agreements(id) on delete cascade,
  work_authorization_id uuid references public.project_subcontract_work_authorizations(id) on delete cascade,
  event_type text not null check (event_type in ('sent','viewed','signed','voided','expired')),
  signer_name text,
  signer_title text,
  signer_email text,
  ip_address text,
  user_agent text,
  document_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subcontractor_signature_events_assignment_idx
  on public.subcontractor_signature_events(company_id, assignment_id, created_at desc);

create table if not exists public.subcontractor_mobilization_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.trade_partner_assignments(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  requirement_type text not null check (requirement_type in ('master_agreement','work_authorization','w9','coi','workers_comp','licenses','safety_acknowledgement','scope_confirmation')),
  required boolean not null default true,
  status text not null default 'missing' check (status in ('missing','pending','verified','waived','expired')),
  verified_at timestamptz,
  verified_by uuid,
  expires_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, assignment_id, requirement_type)
);

create index if not exists subcontractor_mobilization_requirements_assignment_idx
  on public.subcontractor_mobilization_requirements(company_id, assignment_id);

alter table public.trade_partner_assignments
  add column if not exists mobilization_status text not null default 'not_cleared'
    check (mobilization_status in ('not_cleared','cleared','hold')),
  add column if not exists mobilization_cleared_at timestamptz,
  add column if not exists mobilization_blockers jsonb not null default '[]'::jsonb;

create or replace function public.refresh_subcontractor_mobilization_status(
  p_company_id uuid,
  p_assignment_id uuid
) returns table(mobilization_status text, blockers jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blockers jsonb;
  v_status text;
begin
  select coalesce(jsonb_agg(requirement_type order by requirement_type), '[]'::jsonb)
    into v_blockers
  from public.subcontractor_mobilization_requirements
  where company_id = p_company_id
    and assignment_id = p_assignment_id
    and required = true
    and status not in ('verified','waived');

  v_status := case when jsonb_array_length(v_blockers) = 0 then 'cleared' else 'not_cleared' end;

  update public.trade_partner_assignments
     set mobilization_status = v_status,
         mobilization_blockers = v_blockers,
         mobilization_cleared_at = case when v_status = 'cleared' then coalesce(mobilization_cleared_at, now()) else null end,
         updated_at = now()
   where id = p_assignment_id and company_id = p_company_id;

  return query select v_status, v_blockers;
end;
$$;

revoke all on function public.refresh_subcontractor_mobilization_status(uuid, uuid) from public, anon;
grant execute on function public.refresh_subcontractor_mobilization_status(uuid, uuid) to authenticated, service_role;

alter table public.subcontractor_master_agreements enable row level security;
alter table public.project_subcontract_work_authorizations enable row level security;
alter table public.subcontractor_signature_events enable row level security;
alter table public.subcontractor_mobilization_requirements enable row level security;

create policy subcontractor_master_agreements_company_read on public.subcontractor_master_agreements
for select to authenticated using (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy subcontractor_master_agreements_company_write on public.subcontractor_master_agreements
for all to authenticated using (company_id in (select company_id from public.profiles where id = auth.uid())) with check (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy project_subcontract_work_authorizations_company_read on public.project_subcontract_work_authorizations
for select to authenticated using (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy project_subcontract_work_authorizations_company_write on public.project_subcontract_work_authorizations
for all to authenticated using (company_id in (select company_id from public.profiles where id = auth.uid())) with check (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy subcontractor_signature_events_company_read on public.subcontractor_signature_events
for select to authenticated using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy subcontractor_mobilization_requirements_company_read on public.subcontractor_mobilization_requirements
for select to authenticated using (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy subcontractor_mobilization_requirements_company_write on public.subcontractor_mobilization_requirements
for all to authenticated using (company_id in (select company_id from public.profiles where id = auth.uid())) with check (company_id in (select company_id from public.profiles where id = auth.uid()));

revoke insert, update, delete on public.subcontractor_signature_events from anon, authenticated;
grant select on public.subcontractor_signature_events to authenticated;
grant all on public.subcontractor_signature_events to service_role;

begin;

-- Ensure composite keys exist for company-scoped foreign keys.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_id_company_unique'
  ) then
    alter table public.projects
      add constraint projects_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'customers_id_company_unique'
  ) then
    alter table public.customers
      add constraint customers_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_id_company_unique'
  ) then
    alter table public.profiles
      add constraint profiles_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workforce_assignments_id_company_unique'
  ) then
    alter table public.workforce_assignments
      add constraint workforce_assignments_id_company_unique unique (id, company_id);
  end if;
end $$;

create table if not exists public.project_inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  inspection_type text not null,
  jurisdiction text null,
  authority text null,
  inspector_name text null,
  inspector_contact text null,
  scheduled_at timestamptz null,
  completed_at timestamptz null,
  status text not null default 'draft',
  result text null,
  location text null,
  notes text null,
  correction_notes text null,
  reinspection_required boolean not null default false,
  reinspection_date timestamptz null,
  attachments jsonb not null default '[]'::jsonb,
  created_by uuid null,
  updated_by uuid null,
  idempotency_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_inspections_type_not_blank_check check (btrim(inspection_type) <> ''),
  constraint project_inspections_status_check check (
    status in ('draft', 'scheduled', 'in_progress', 'passed', 'failed', 'cancelled', 'reinspection_required')
  ),
  constraint project_inspections_result_check check (
    result is null or result in ('pending', 'passed', 'failed', 'cancelled')
  ),
  constraint project_inspections_completed_after_scheduled_check check (
    completed_at is null or scheduled_at is null or completed_at >= scheduled_at
  ),
  constraint project_inspections_reinspection_date_required_check check (
    (reinspection_required = false)
    or (reinspection_required = true and reinspection_date is not null)
  )
);

alter table public.project_inspections
  drop constraint if exists project_inspections_project_company_fkey,
  add constraint project_inspections_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.project_inspections
  drop constraint if exists project_inspections_created_by_company_fkey,
  add constraint project_inspections_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_inspections
  drop constraint if exists project_inspections_updated_by_company_fkey,
  add constraint project_inspections_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create unique index if not exists idx_project_inspections_company_idempotency
  on public.project_inspections(company_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_project_inspections_company_project_status
  on public.project_inspections(company_id, project_id, status, scheduled_at desc);

create index if not exists idx_project_inspections_company_reinspection
  on public.project_inspections(company_id, reinspection_required, reinspection_date);

create table if not exists public.project_permits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  permit_type text not null,
  permit_number text null,
  issuing_authority text null,
  jurisdiction text null,
  application_date date null,
  submitted_at timestamptz null,
  approved_at timestamptz null,
  issued_at timestamptz null,
  expiration_date date null,
  closed_at timestamptz null,
  status text not null default 'required',
  fee_amount numeric(12,2) not null default 0,
  fee_paid numeric(12,2) not null default 0,
  responsible_party text null,
  notes text null,
  rejection_reason text null,
  renewal_required boolean not null default false,
  created_by uuid null,
  updated_by uuid null,
  idempotency_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_permits_type_not_blank_check check (btrim(permit_type) <> ''),
  constraint project_permits_status_check check (
    status in ('required', 'preparing', 'submitted', 'under_review', 'approved', 'issued', 'rejected', 'expired', 'renewal_required', 'closed', 'not_required', 'cancelled')
  ),
  constraint project_permits_fee_amount_non_negative_check check (fee_amount >= 0),
  constraint project_permits_fee_paid_non_negative_check check (fee_paid >= 0),
  constraint project_permits_fee_paid_lte_amount_check check (fee_paid <= fee_amount),
  constraint project_permits_date_order_check check (
    (approved_at is null or submitted_at is null or approved_at >= submitted_at)
    and (issued_at is null or approved_at is null or issued_at >= approved_at)
  )
);

alter table public.project_permits
  drop constraint if exists project_permits_project_company_fkey,
  add constraint project_permits_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.project_permits
  drop constraint if exists project_permits_created_by_company_fkey,
  add constraint project_permits_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_permits
  drop constraint if exists project_permits_updated_by_company_fkey,
  add constraint project_permits_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create unique index if not exists idx_project_permits_company_idempotency
  on public.project_permits(company_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_project_permits_company_project_status
  on public.project_permits(company_id, project_id, status, expiration_date);

create index if not exists idx_project_permits_company_expiration
  on public.project_permits(company_id, expiration_date, status);

create table if not exists public.project_closeouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  status text not null default 'draft',
  started_at timestamptz not null default now(),
  completion_date timestamptz null,
  closeout_notes text null,
  final_payment_recorded boolean not null default false,
  customer_approval_recorded boolean not null default false,
  required_documents_completed boolean not null default false,
  permit_closure_completed boolean not null default false,
  crew_removal_completed boolean not null default false,
  equipment_return_completed boolean not null default false,
  handover_status text not null default 'pending',
  authorized_exceptions jsonb not null default '[]'::jsonb,
  completion_blockers jsonb not null default '[]'::jsonb,
  created_by uuid null,
  updated_by uuid null,
  completed_by uuid null,
  idempotency_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_closeouts_status_check check (status in ('draft', 'in_progress', 'blocked', 'completed', 'archived')),
  constraint project_closeouts_handover_status_check check (handover_status in ('pending', 'walkthrough_completed', 'completed')),
  constraint project_closeouts_completion_date_check check (
    completion_date is null or completion_date >= started_at
  )
);

alter table public.project_closeouts
  drop constraint if exists project_closeouts_project_company_fkey,
  add constraint project_closeouts_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.project_closeouts
  drop constraint if exists project_closeouts_created_by_company_fkey,
  add constraint project_closeouts_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_closeouts
  drop constraint if exists project_closeouts_updated_by_company_fkey,
  add constraint project_closeouts_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_closeouts
  drop constraint if exists project_closeouts_completed_by_company_fkey,
  add constraint project_closeouts_completed_by_company_fkey
    foreign key (completed_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create unique index if not exists idx_project_closeouts_company_project_unique
  on public.project_closeouts(company_id, project_id);

create unique index if not exists idx_project_closeouts_company_idempotency
  on public.project_closeouts(company_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.project_closeout_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  closeout_id uuid not null,
  project_id uuid not null,
  category text not null,
  item_key text not null,
  title text not null,
  required boolean not null default true,
  completed boolean not null default false,
  completed_at timestamptz null,
  completed_by uuid null,
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_closeout_items_category_check check (
    category in ('work_complete', 'punch_items', 'inspection', 'permit', 'change_orders', 'invoices', 'payment', 'handover', 'warranty', 'documents', 'equipment', 'crew')
  ),
  constraint project_closeout_items_item_key_not_blank_check check (btrim(item_key) <> ''),
  constraint project_closeout_items_title_not_blank_check check (btrim(title) <> ''),
  constraint project_closeout_items_completion_requires_timestamp_check check (
    completed = false or completed_at is not null
  )
);

alter table public.project_closeout_items
  drop constraint if exists project_closeout_items_closeout_company_fkey,
  add constraint project_closeout_items_closeout_company_fkey
    foreign key (closeout_id)
    references public.project_closeouts(id)
    on delete cascade;

alter table public.project_closeout_items
  drop constraint if exists project_closeout_items_project_company_fkey,
  add constraint project_closeout_items_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.project_closeout_items
  drop constraint if exists project_closeout_items_completed_by_company_fkey,
  add constraint project_closeout_items_completed_by_company_fkey
    foreign key (completed_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_closeout_items
  drop constraint if exists project_closeout_items_created_by_company_fkey,
  add constraint project_closeout_items_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_closeout_items
  drop constraint if exists project_closeout_items_updated_by_company_fkey,
  add constraint project_closeout_items_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create unique index if not exists idx_project_closeout_items_unique_key
  on public.project_closeout_items(company_id, closeout_id, item_key);

create index if not exists idx_project_closeout_items_company_project_completed
  on public.project_closeout_items(company_id, project_id, completed);

create table if not exists public.project_punch_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  closeout_id uuid null,
  title text not null,
  description text null,
  location text null,
  status text not null default 'open',
  priority text not null default 'medium',
  assigned_profile_id uuid null,
  due_date date null,
  completed_at timestamptz null,
  reopened_at timestamptz null,
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  idempotency_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_punch_items_title_not_blank_check check (btrim(title) <> ''),
  constraint project_punch_items_status_check check (status in ('open', 'assigned', 'in_progress', 'completed', 'reopened', 'cancelled')),
  constraint project_punch_items_priority_check check (priority in ('low', 'medium', 'high', 'critical')),
  constraint project_punch_items_completed_date_check check (
    completed_at is null or completed_at >= created_at
  )
);

alter table public.project_punch_items
  drop constraint if exists project_punch_items_project_company_fkey,
  add constraint project_punch_items_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.project_punch_items
  drop constraint if exists project_punch_items_closeout_company_fkey,
  add constraint project_punch_items_closeout_company_fkey
    foreign key (closeout_id)
    references public.project_closeouts(id)
    on delete set null;

alter table public.project_punch_items
  drop constraint if exists project_punch_items_assigned_profile_company_fkey,
  add constraint project_punch_items_assigned_profile_company_fkey
    foreign key (assigned_profile_id, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_punch_items
  drop constraint if exists project_punch_items_created_by_company_fkey,
  add constraint project_punch_items_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_punch_items
  drop constraint if exists project_punch_items_updated_by_company_fkey,
  add constraint project_punch_items_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create unique index if not exists idx_project_punch_items_company_idempotency
  on public.project_punch_items(company_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_project_punch_items_company_project_status
  on public.project_punch_items(company_id, project_id, status, due_date);

create table if not exists public.project_warranties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  closeout_id uuid null,
  status text not null default 'inactive',
  starts_at timestamptz null,
  ends_at timestamptz null,
  provider_name text null,
  details text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_warranties_status_check check (status in ('inactive', 'active', 'expired', 'cancelled')),
  constraint project_warranties_date_order_check check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

alter table public.project_warranties
  drop constraint if exists project_warranties_project_company_fkey,
  add constraint project_warranties_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.project_warranties
  drop constraint if exists project_warranties_closeout_company_fkey,
  add constraint project_warranties_closeout_company_fkey
    foreign key (closeout_id)
    references public.project_closeouts(id)
    on delete set null;

alter table public.project_warranties
  drop constraint if exists project_warranties_created_by_company_fkey,
  add constraint project_warranties_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

alter table public.project_warranties
  drop constraint if exists project_warranties_updated_by_company_fkey,
  add constraint project_warranties_updated_by_company_fkey
    foreign key (updated_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create unique index if not exists idx_project_warranties_company_project_unique
  on public.project_warranties(company_id, project_id);

create table if not exists public.project_communications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  customer_id uuid null,
  channel text not null,
  direction text not null,
  recipient_name text null,
  recipient_address text null,
  subject text null,
  message text not null,
  status text not null default 'draft',
  sent_at timestamptz null,
  delivered_at timestamptz null,
  failed_at timestamptz null,
  failure_reason text null,
  created_by uuid null,
  correlation_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint project_communications_channel_check check (
    channel in ('portal', 'email', 'sms', 'phone_note', 'in_person_note', 'system_notification')
  ),
  constraint project_communications_direction_check check (
    direction in ('outbound', 'inbound', 'internal')
  ),
  constraint project_communications_status_check check (
    status in ('draft', 'pending_confirmation', 'queued', 'sent', 'delivered', 'failed', 'cancelled', 'logged_only')
  ),
  constraint project_communications_message_not_blank_check check (btrim(message) <> ''),
  constraint project_communications_correlation_not_blank_check check (btrim(correlation_id) <> '')
);

alter table public.project_communications
  drop constraint if exists project_communications_project_company_fkey,
  add constraint project_communications_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete cascade;

alter table public.project_communications
  drop constraint if exists project_communications_customer_company_fkey,
  add constraint project_communications_customer_company_fkey
    foreign key (customer_id, company_id)
    references public.customers(id, company_id)
    on delete set null;

alter table public.project_communications
  drop constraint if exists project_communications_created_by_company_fkey,
  add constraint project_communications_created_by_company_fkey
    foreign key (created_by, company_id)
    references public.profiles(id, company_id)
    on delete set null;

create unique index if not exists idx_project_communications_company_correlation
  on public.project_communications(company_id, correlation_id);

create index if not exists idx_project_communications_company_project_created
  on public.project_communications(company_id, project_id, created_at desc);

create index if not exists idx_project_communications_company_customer_created
  on public.project_communications(company_id, customer_id, created_at desc)
  where customer_id is not null;

-- Row-level security
alter table public.project_inspections enable row level security;
alter table public.project_permits enable row level security;
alter table public.project_closeouts enable row level security;
alter table public.project_closeout_items enable row level security;
alter table public.project_punch_items enable row level security;
alter table public.project_warranties enable row level security;
alter table public.project_communications enable row level security;

drop policy if exists project_inspections_select on public.project_inspections;
drop policy if exists project_inspections_insert on public.project_inspections;
drop policy if exists project_inspections_update on public.project_inspections;
drop policy if exists project_inspections_delete on public.project_inspections;

create policy project_inspections_select
on public.project_inspections
for select to authenticated
using (public.is_company_member(project_inspections.company_id));

create policy project_inspections_insert
on public.project_inspections
for insert to authenticated
with check (
  public.has_company_role(project_inspections.company_id, array['owner','administrator','operations_manager','project_manager','superintendent','office_manager'])
  and (project_inspections.created_by is null or project_inspections.created_by = auth.uid())
);

create policy project_inspections_update
on public.project_inspections
for update to authenticated
using (public.has_company_role(project_inspections.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']))
with check (public.has_company_role(project_inspections.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']));

create policy project_inspections_delete
on public.project_inspections
for delete to authenticated
using (public.has_company_role(project_inspections.company_id, array['owner','administrator','operations_manager','project_manager']));

drop policy if exists project_permits_select on public.project_permits;
drop policy if exists project_permits_insert on public.project_permits;
drop policy if exists project_permits_update on public.project_permits;
drop policy if exists project_permits_delete on public.project_permits;

create policy project_permits_select
on public.project_permits
for select to authenticated
using (public.is_company_member(project_permits.company_id));

create policy project_permits_insert
on public.project_permits
for insert to authenticated
with check (
  public.has_company_role(project_permits.company_id, array['owner','administrator','operations_manager','project_manager','superintendent','office_manager'])
  and (project_permits.created_by is null or project_permits.created_by = auth.uid())
);

create policy project_permits_update
on public.project_permits
for update to authenticated
using (public.has_company_role(project_permits.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']))
with check (public.has_company_role(project_permits.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']));

create policy project_permits_delete
on public.project_permits
for delete to authenticated
using (public.has_company_role(project_permits.company_id, array['owner','administrator','operations_manager','project_manager']));

drop policy if exists project_closeouts_select on public.project_closeouts;
drop policy if exists project_closeouts_insert on public.project_closeouts;
drop policy if exists project_closeouts_update on public.project_closeouts;
drop policy if exists project_closeouts_delete on public.project_closeouts;

create policy project_closeouts_select
on public.project_closeouts
for select to authenticated
using (public.is_company_member(project_closeouts.company_id));

create policy project_closeouts_insert
on public.project_closeouts
for insert to authenticated
with check (
  public.has_company_role(project_closeouts.company_id, array['owner','administrator','operations_manager','project_manager','superintendent'])
  and (project_closeouts.created_by is null or project_closeouts.created_by = auth.uid())
);

create policy project_closeouts_update
on public.project_closeouts
for update to authenticated
using (public.has_company_role(project_closeouts.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']))
with check (public.has_company_role(project_closeouts.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']));

create policy project_closeouts_delete
on public.project_closeouts
for delete to authenticated
using (public.has_company_role(project_closeouts.company_id, array['owner','administrator']));

drop policy if exists project_closeout_items_select on public.project_closeout_items;
drop policy if exists project_closeout_items_insert on public.project_closeout_items;
drop policy if exists project_closeout_items_update on public.project_closeout_items;
drop policy if exists project_closeout_items_delete on public.project_closeout_items;

create policy project_closeout_items_select
on public.project_closeout_items
for select to authenticated
using (public.is_company_member(project_closeout_items.company_id));

create policy project_closeout_items_insert
on public.project_closeout_items
for insert to authenticated
with check (public.has_company_role(project_closeout_items.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']));

create policy project_closeout_items_update
on public.project_closeout_items
for update to authenticated
using (public.has_company_role(project_closeout_items.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']))
with check (public.has_company_role(project_closeout_items.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']));

create policy project_closeout_items_delete
on public.project_closeout_items
for delete to authenticated
using (public.has_company_role(project_closeout_items.company_id, array['owner','administrator','operations_manager','project_manager']));

drop policy if exists project_punch_items_select on public.project_punch_items;
drop policy if exists project_punch_items_insert on public.project_punch_items;
drop policy if exists project_punch_items_update on public.project_punch_items;
drop policy if exists project_punch_items_delete on public.project_punch_items;

create policy project_punch_items_select
on public.project_punch_items
for select to authenticated
using (public.is_company_member(project_punch_items.company_id));

create policy project_punch_items_insert
on public.project_punch_items
for insert to authenticated
with check (
  public.has_company_role(project_punch_items.company_id, array['owner','administrator','operations_manager','project_manager','superintendent','employee'])
  and (project_punch_items.created_by is null or project_punch_items.created_by = auth.uid())
);

create policy project_punch_items_update
on public.project_punch_items
for update to authenticated
using (public.has_company_role(project_punch_items.company_id, array['owner','administrator','operations_manager','project_manager','superintendent','employee']))
with check (public.has_company_role(project_punch_items.company_id, array['owner','administrator','operations_manager','project_manager','superintendent','employee']));

create policy project_punch_items_delete
on public.project_punch_items
for delete to authenticated
using (public.has_company_role(project_punch_items.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']));

drop policy if exists project_warranties_select on public.project_warranties;
drop policy if exists project_warranties_insert on public.project_warranties;
drop policy if exists project_warranties_update on public.project_warranties;
drop policy if exists project_warranties_delete on public.project_warranties;

create policy project_warranties_select
on public.project_warranties
for select to authenticated
using (public.is_company_member(project_warranties.company_id));

create policy project_warranties_insert
on public.project_warranties
for insert to authenticated
with check (public.has_company_role(project_warranties.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']));

create policy project_warranties_update
on public.project_warranties
for update to authenticated
using (public.has_company_role(project_warranties.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']))
with check (public.has_company_role(project_warranties.company_id, array['owner','administrator','operations_manager','project_manager','superintendent']));

create policy project_warranties_delete
on public.project_warranties
for delete to authenticated
using (public.has_company_role(project_warranties.company_id, array['owner','administrator']));

drop policy if exists project_communications_select on public.project_communications;
drop policy if exists project_communications_insert on public.project_communications;
drop policy if exists project_communications_update on public.project_communications;
drop policy if exists project_communications_delete on public.project_communications;

create policy project_communications_select
on public.project_communications
for select to authenticated
using (public.is_company_member(project_communications.company_id));

create policy project_communications_insert
on public.project_communications
for insert to authenticated
with check (
  public.has_company_role(project_communications.company_id, array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','employee'])
  and (project_communications.created_by is null or project_communications.created_by = auth.uid())
);

create policy project_communications_update
on public.project_communications
for update to authenticated
using (public.has_company_role(project_communications.company_id, array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','employee']))
with check (public.has_company_role(project_communications.company_id, array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','employee']));

create policy project_communications_delete
on public.project_communications
for delete to authenticated
using (public.has_company_role(project_communications.company_id, array['owner','administrator','operations_manager','project_manager','superintendent','office_manager']));

commit;

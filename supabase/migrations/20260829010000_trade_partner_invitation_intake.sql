begin;

create table if not exists public.trade_partner_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  token_hash text not null unique check (btrim(token_hash) <> ''),
  email text,
  phone text,
  first_name text,
  last_name text,
  status text not null default 'sent' check (status in ('sent','opened','claimed','completed','expired','cancelled')),
  delivery_channels text[] not null default '{}'::text[],
  delivery_metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  opened_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vendor_id, company_id) references public.vendors(id, company_id) on delete cascade,
  check (email is not null or phone is not null)
);

create index if not exists trade_partner_invitations_company_status_idx
  on public.trade_partner_invitations(company_id, status, created_at desc);

create index if not exists trade_partner_invitations_vendor_idx
  on public.trade_partner_invitations(company_id, vendor_id, created_at desc);

create index if not exists trade_partner_invitations_expiry_idx
  on public.trade_partner_invitations(expires_at)
  where status in ('sent','opened');

alter table public.trade_partner_invitations enable row level security;

drop policy if exists trade_partner_invitations_internal_select on public.trade_partner_invitations;
create policy trade_partner_invitations_internal_select on public.trade_partner_invitations
for select to authenticated using (
  public.has_company_role(company_id, array['owner','administrator','office_manager','project_manager'])
);

drop policy if exists trade_partner_invitations_internal_update on public.trade_partner_invitations;
create policy trade_partner_invitations_internal_update on public.trade_partner_invitations
for update to authenticated using (
  public.has_company_role(company_id, array['owner','administrator'])
) with check (
  public.has_company_role(company_id, array['owner','administrator'])
);

commit;

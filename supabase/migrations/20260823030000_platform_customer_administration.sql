begin;

create schema if not exists private;

create table if not exists public.bos_platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'support' check (role in ('owner', 'administrator', 'support', 'billing')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bos_tenant_accounts (
  company_id uuid primary key references public.companies(id) on delete cascade,
  plan_key text not null default 'starter' check (plan_key in ('starter', 'professional', 'business', 'enterprise')),
  lifecycle_status text not null default 'trial' check (lifecycle_status in ('trial', 'active', 'past_due', 'suspended', 'canceled')),
  seat_limit integer not null default 2 check (seat_limit > 0),
  orion_text_allowance integer not null default 200 check (orion_text_allowance >= 0),
  orion_voice_minutes integer not null default 30 check (orion_voice_minutes >= 0),
  trial_ends_at timestamptz,
  billing_customer_ref text,
  subscription_ref text,
  support_tier text not null default 'standard' check (support_tier in ('standard', 'priority', 'dedicated')),
  onboarding_state jsonb not null default '{}'::jsonb,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bos_platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id),
  company_id uuid references public.companies(id) on delete set null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bos_tenant_accounts_status_idx on public.bos_tenant_accounts (lifecycle_status);
create index if not exists bos_tenant_accounts_plan_idx on public.bos_tenant_accounts (plan_key);
create index if not exists bos_platform_audit_log_company_created_idx on public.bos_platform_audit_log (company_id, created_at desc);
create index if not exists bos_platform_audit_log_actor_idx on public.bos_platform_audit_log (actor_user_id);

create or replace function private.is_bos_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bos_platform_admins admin
    where admin.user_id = (select auth.uid())
      and admin.active
  );
$$;

revoke all on function private.is_bos_platform_admin() from public;
grant execute on function private.is_bos_platform_admin() to authenticated;

alter table public.bos_platform_admins enable row level security;
alter table public.bos_tenant_accounts enable row level security;
alter table public.bos_platform_audit_log enable row level security;

create policy "platform admins read platform administrators"
  on public.bos_platform_admins for select to authenticated
  using ((select private.is_bos_platform_admin()));

create policy "platform admins read tenant accounts"
  on public.bos_tenant_accounts for select to authenticated
  using ((select private.is_bos_platform_admin()));

create policy "platform admins update tenant accounts"
  on public.bos_tenant_accounts for update to authenticated
  using ((select private.is_bos_platform_admin()))
  with check ((select private.is_bos_platform_admin()));

create policy "platform admins read platform audit log"
  on public.bos_platform_audit_log for select to authenticated
  using ((select private.is_bos_platform_admin()));

create policy "platform admins write platform audit log"
  on public.bos_platform_audit_log for insert to authenticated
  with check ((select private.is_bos_platform_admin()) and actor_user_id = (select auth.uid()));

create policy "platform admins read customer companies"
  on public.companies for select to authenticated
  using ((select private.is_bos_platform_admin()));

create policy "platform admins read customer memberships"
  on public.company_memberships for select to authenticated
  using ((select private.is_bos_platform_admin()));

create policy "platform admins read customer project counts"
  on public.projects for select to authenticated
  using ((select private.is_bos_platform_admin()));

grant select on public.bos_platform_admins to authenticated;
grant select, update on public.bos_tenant_accounts to authenticated;
grant select, insert on public.bos_platform_audit_log to authenticated;
grant all on public.bos_platform_admins, public.bos_tenant_accounts, public.bos_platform_audit_log to service_role;

insert into public.bos_tenant_accounts (company_id, plan_key, lifecycle_status, seat_limit, orion_text_allowance, orion_voice_minutes, support_tier)
select id, 'business', 'active', 15, 3000, 400, 'priority'
from public.companies
on conflict (company_id) do nothing;

commit;

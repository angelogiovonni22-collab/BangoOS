begin;

create table if not exists public.change_order_customer_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  change_order_id uuid not null,
  token_hash text not null,
  expires_at timestamptz not null,
  issued_by uuid null references public.profiles(id) on delete set null,
  used_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint change_order_customer_tokens_co_company_fkey
    foreign key (change_order_id, company_id)
    references public.change_orders(id, company_id)
    on delete cascade
);

create unique index if not exists idx_change_order_customer_tokens_hash
  on public.change_order_customer_tokens(token_hash);
create index if not exists idx_change_order_customer_tokens_change_order
  on public.change_order_customer_tokens(company_id, change_order_id, created_at desc);

create table if not exists public.change_order_customer_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  change_order_id uuid not null,
  token_id uuid not null references public.change_order_customer_tokens(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected')),
  typed_name text not null,
  consent_accepted boolean not null default false,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now(),
  constraint change_order_customer_approvals_co_company_fkey
    foreign key (change_order_id, company_id)
    references public.change_orders(id, company_id)
    on delete cascade
);

create unique index if not exists idx_change_order_customer_approvals_token
  on public.change_order_customer_approvals(token_id);
create index if not exists idx_change_order_customer_approvals_change_order
  on public.change_order_customer_approvals(company_id, change_order_id, created_at desc);

alter table public.change_order_customer_tokens enable row level security;
alter table public.change_order_customer_approvals enable row level security;

create policy change_order_customer_tokens_select
on public.change_order_customer_tokens
for select to authenticated
using (public.is_company_member(company_id));

create policy change_order_customer_approvals_select
on public.change_order_customer_approvals
for select to authenticated
using (public.is_company_member(company_id));

comment on table public.change_order_customer_tokens is
  'Secure expiring customer approval links for change orders.';
comment on table public.change_order_customer_approvals is
  'Customer approval or rejection evidence captured from secure change-order links.';

commit;

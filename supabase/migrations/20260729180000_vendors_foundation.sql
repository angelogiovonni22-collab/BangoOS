begin;

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_code text not null,
  company_name text not null,
  display_name text not null,
  status text not null default 'active',
  preferred_vendor boolean not null default false,

  website text null,
  tax_id text null,
  account_number text null,
  payment_terms text null,
  credit_limit numeric(14,2) null,

  billing_address text null,
  shipping_address text null,
  city text null,
  state text null,
  postal_code text null,
  country text null,

  first_name text null,
  last_name text null,
  title text null,
  email text null,
  phone text null,
  mobile text null,

  quality_rating numeric(3,2) null,
  delivery_rating numeric(3,2) null,
  notes text null,

  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vendors_vendor_code_not_blank_check check (btrim(vendor_code) <> ''),
  constraint vendors_company_name_not_blank_check check (btrim(company_name) <> ''),
  constraint vendors_display_name_not_blank_check check (btrim(display_name) <> ''),
  constraint vendors_status_check check (
    status in ('active', 'inactive', 'probation', 'suspended', 'archived')
  ),
  constraint vendors_credit_limit_non_negative_check check (credit_limit is null or credit_limit >= 0),
  constraint vendors_quality_rating_range_check check (
    quality_rating is null or (quality_rating >= 0 and quality_rating <= 5)
  ),
  constraint vendors_delivery_rating_range_check check (
    delivery_rating is null or (delivery_rating >= 0 and delivery_rating <= 5)
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendors_company_id_vendor_code_unique'
  ) then
    alter table public.vendors
      add constraint vendors_company_id_vendor_code_unique unique (company_id, vendor_code);
  end if;
end $$;

create index if not exists idx_vendors_company_status
  on public.vendors(company_id, status);

create index if not exists idx_vendors_company_preferred
  on public.vendors(company_id, preferred_vendor);

create index if not exists idx_vendors_company_display_name
  on public.vendors(company_id, display_name);

create index if not exists idx_vendors_company_created_at
  on public.vendors(company_id, created_at desc);

create index if not exists idx_vendors_company_quality_rating
  on public.vendors(company_id, quality_rating desc nulls last);

alter table public.vendors enable row level security;

drop policy if exists vendors_select on public.vendors;
drop policy if exists vendors_insert on public.vendors;
drop policy if exists vendors_update on public.vendors;
drop policy if exists vendors_delete on public.vendors;

create policy vendors_select
on public.vendors
for select
to authenticated
using (
  public.is_company_member(vendors.company_id)
);

create policy vendors_insert
on public.vendors
for insert
to authenticated
with check (
  public.has_company_role(
    vendors.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant']
  )
  and (vendors.created_by is null or vendors.created_by = auth.uid())
  and (vendors.updated_by is null or vendors.updated_by = auth.uid())
);

create policy vendors_update
on public.vendors
for update
to authenticated
using (
  public.has_company_role(
    vendors.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant']
  )
)
with check (
  public.has_company_role(
    vendors.company_id,
    array['owner', 'administrator', 'operations_manager', 'office_manager', 'accountant']
  )
  and (vendors.updated_by is null or vendors.updated_by = auth.uid())
);

create policy vendors_delete
on public.vendors
for delete
to authenticated
using (
  public.has_company_role(vendors.company_id, array['owner', 'administrator'])
);

do $$
declare
  v_updated_at_fn regprocedure;
begin
  select p.oid::regprocedure
    into v_updated_at_fn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_attribute a
    on a.attrelid = c.oid
   and a.attname = 'updated_at'
  where n.nspname = 'public'
    and c.relname in (
      'companies',
      'customers',
      'profiles',
      'projects',
      'estimates',
      'invoices',
      'project_phases',
      'tasks'
    )
    and not t.tgisinternal
  order by c.relname, t.tgname
  limit 1;

  if v_updated_at_fn is null then
    raise exception 'No updated_at trigger function found to reuse.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'vendors'
      and t.tgname = 'trg_vendors_set_updated_at'
  ) then
    execute format(
      'create trigger trg_vendors_set_updated_at before update on public.vendors for each row execute function %s;',
      v_updated_at_fn
    );
  end if;
end $$;

commit;

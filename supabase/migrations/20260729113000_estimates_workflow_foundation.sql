begin;

alter table public.estimates
  add column if not exists prepared_by uuid null references public.profiles(id) on delete set null,
  add column if not exists direct_cost_subtotal numeric(14,2) not null default 0,
  add column if not exists markup_total numeric(14,2) not null default 0,
  add column if not exists discount_total numeric(14,2) not null default 0,
  add column if not exists additional_fee numeric(14,2) not null default 0,
  add column if not exists scope_inclusions text null,
  add column if not exists scope_exclusions text null,
  add column if not exists terms text null,
  add column if not exists payment_terms text null,
  add column if not exists archived_at timestamptz null;

alter table public.estimates
  drop constraint if exists estimates_direct_cost_subtotal_check,
  add constraint estimates_direct_cost_subtotal_check
    check (direct_cost_subtotal >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_markup_total_check,
  add constraint estimates_markup_total_check
    check (markup_total >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_discount_total_check,
  add constraint estimates_discount_total_check
    check (discount_total >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_additional_fee_check,
  add constraint estimates_additional_fee_check
    check (additional_fee >= 0)
    not valid;

alter table public.estimates
  drop constraint if exists estimates_status_check,
  add constraint estimates_status_check
    check (
      status in (
        'draft',
        'internal_review',
        'sent',
        'viewed',
        'approved',
        'rejected',
        'expired',
        'archived',
        'ready',
        'revision_requested',
        'void',
        'superseded'
      )
    )
    not valid;

create table if not exists public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null,
  sort_order integer not null default 1000,
  item_code text null,
  category text not null default 'other',
  description text not null,
  quantity numeric(14,4) not null default 0,
  unit text not null default 'each',
  unit_cost numeric(14,4) not null default 0,
  markup_percent numeric(9,4) not null default 0,
  unit_price numeric(14,4) not null default 0,
  line_total numeric(14,4) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint estimate_line_items_sort_order_check
    check (sort_order >= 0),

  constraint estimate_line_items_category_check
    check (
      category in (
        'labor',
        'materials',
        'equipment',
        'subcontractors',
        'general_conditions',
        'permits_fees',
        'other'
      )
    ),

  constraint estimate_line_items_description_not_blank_check
    check (btrim(description) <> ''),

  constraint estimate_line_items_quantity_check
    check (quantity >= 0),

  constraint estimate_line_items_unit_cost_check
    check (unit_cost >= 0),

  constraint estimate_line_items_markup_percent_check
    check (markup_percent >= 0),

  constraint estimate_line_items_unit_price_check
    check (unit_price >= 0),

  constraint estimate_line_items_line_total_check
    check (line_total >= 0),

  constraint estimate_line_items_unit_check
    check (
      unit in (
        'each',
        'hour',
        'day',
        'week',
        'square_foot',
        'linear_foot',
        'cubic_yard',
        'lump_sum'
      )
    ),

  constraint estimate_line_items_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade
);

create index if not exists idx_estimate_line_items_estimate_sort_order
  on public.estimate_line_items(estimate_id, sort_order);

create index if not exists idx_estimate_line_items_company_id
  on public.estimate_line_items(company_id);

alter table public.estimate_line_items enable row level security;

drop policy if exists estimate_line_items_select on public.estimate_line_items;
drop policy if exists estimate_line_items_insert on public.estimate_line_items;
drop policy if exists estimate_line_items_update on public.estimate_line_items;
drop policy if exists estimate_line_items_delete on public.estimate_line_items;

create policy estimate_line_items_select
on public.estimate_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_line_items.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = estimate_line_items.estimate_id
      and e.company_id = estimate_line_items.company_id
  )
);

create policy estimate_line_items_insert
on public.estimate_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_line_items.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = estimate_line_items.estimate_id
      and e.company_id = estimate_line_items.company_id
  )
);

create policy estimate_line_items_update
on public.estimate_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_line_items.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_line_items.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = estimate_line_items.estimate_id
      and e.company_id = estimate_line_items.company_id
  )
);

create policy estimate_line_items_delete
on public.estimate_line_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = estimate_line_items.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = estimate_line_items.estimate_id
      and e.company_id = estimate_line_items.company_id
  )
);

-- Reuse existing updated_at trigger function from current schema to avoid duplicate utility functions.
do $$
declare
  v_fn regprocedure;
begin
  select p.oid::regprocedure
    into v_fn
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

  if v_fn is null then
    raise exception
      'No existing updated_at trigger function found to reuse. Migration aborted to avoid creating duplicate function.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'estimate_line_items'
      and t.tgname = 'trg_estimate_line_items_set_updated_at'
  ) then
    execute format(
      'create trigger trg_estimate_line_items_set_updated_at before update on public.estimate_line_items for each row execute function %s;',
      v_fn
    );
  end if;
end $$;

commit;

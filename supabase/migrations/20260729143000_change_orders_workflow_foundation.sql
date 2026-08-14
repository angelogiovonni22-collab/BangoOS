begin;

-- Ensure parent tables expose (id, company_id) pairs for company-scoped foreign keys.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_id_company_unique'
  ) then
    alter table public.customers
      add constraint customers_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_id_company_unique'
  ) then
    alter table public.projects
      add constraint projects_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_id_company_unique'
  ) then
    alter table public.estimates
      add constraint estimates_id_company_unique unique (id, company_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_id_company_unique'
  ) then
    alter table public.invoices
      add constraint invoices_id_company_unique unique (id, company_id);
  end if;
end $$;

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  change_order_number text not null,
  title text not null,
  description text null,
  status text not null default 'draft',
  customer_id uuid null,
  project_id uuid not null,
  estimate_id uuid null,
  invoice_id uuid null,
  requested_by uuid null references public.profiles(id) on delete set null,
  prepared_by uuid null references public.profiles(id) on delete set null,
  approved_by uuid null references public.profiles(id) on delete set null,
  rejected_by uuid null references public.profiles(id) on delete set null,
  requested_date date null,
  submitted_at timestamptz null,
  approved_at timestamptz null,
  rejected_at timestamptz null,
  effective_date date null,
  schedule_impact_days integer not null default 0,
  reason text null,
  customer_notes text null,
  internal_notes text null,
  subtotal numeric(14,2) not null default 0,
  tax_rate numeric(8,4) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  archived_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint change_orders_number_not_blank_check
    check (btrim(change_order_number) <> ''),

  constraint change_orders_title_not_blank_check
    check (btrim(title) <> ''),

  constraint change_orders_status_check
    check (
      status in (
        'draft',
        'pending_approval',
        'approved',
        'rejected',
        'invoiced',
        'void'
      )
    ),

  constraint change_orders_subtotal_check
    check (subtotal >= 0),

  constraint change_orders_tax_rate_check
    check (tax_rate >= 0),

  constraint change_orders_tax_amount_check
    check (tax_amount >= 0),

  constraint change_orders_total_amount_check
    check (total_amount >= 0)
);

-- Composite unique is required before child table composite foreign keys.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'change_orders_id_company_unique'
  ) then
    alter table public.change_orders
      add constraint change_orders_id_company_unique unique (id, company_id);
  end if;
end $$;

alter table public.change_orders
  drop constraint if exists change_orders_company_number_unique,
  add constraint change_orders_company_number_unique
    unique (company_id, change_order_number);

alter table public.change_orders
  drop constraint if exists change_orders_customer_company_fkey,
  add constraint change_orders_customer_company_fkey
    foreign key (customer_id, company_id)
    references public.customers(id, company_id)
    on delete set null;

alter table public.change_orders
  drop constraint if exists change_orders_project_company_fkey,
  add constraint change_orders_project_company_fkey
    foreign key (project_id, company_id)
    references public.projects(id, company_id)
    on delete restrict;

alter table public.change_orders
  drop constraint if exists change_orders_estimate_company_fkey,
  add constraint change_orders_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete set null;

alter table public.change_orders
  drop constraint if exists change_orders_invoice_company_fkey,
  add constraint change_orders_invoice_company_fkey
    foreign key (invoice_id, company_id)
    references public.invoices(id, company_id)
    on delete set null;

create index if not exists idx_change_orders_company_status
  on public.change_orders(company_id, status);

create index if not exists idx_change_orders_company_project
  on public.change_orders(company_id, project_id);

create index if not exists idx_change_orders_company_customer
  on public.change_orders(company_id, customer_id);

create index if not exists idx_change_orders_company_number
  on public.change_orders(company_id, change_order_number);

create index if not exists idx_change_orders_company_archived_at
  on public.change_orders(company_id, archived_at);

create index if not exists idx_change_orders_project_created_at
  on public.change_orders(project_id, created_at desc);

create table if not exists public.change_order_line_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  change_order_id uuid not null,
  sort_order integer not null default 1000,
  description text not null,
  quantity numeric(14,4) not null default 0,
  unit text not null default 'each',
  unit_cost numeric(14,4) not null default 0,
  unit_price numeric(14,4) not null default 0,
  cost_amount numeric(14,2) not null default 0,
  price_amount numeric(14,2) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint change_order_line_items_sort_order_check
    check (sort_order >= 0),

  constraint change_order_line_items_description_not_blank_check
    check (btrim(description) <> ''),

  constraint change_order_line_items_quantity_check
    check (quantity >= 0),

  constraint change_order_line_items_unit_cost_check
    check (unit_cost >= 0),

  constraint change_order_line_items_unit_price_check
    check (unit_price >= 0),

  constraint change_order_line_items_cost_amount_check
    check (cost_amount >= 0),

  constraint change_order_line_items_price_amount_check
    check (price_amount >= 0),

  constraint change_order_line_items_unit_check
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

  constraint change_order_line_items_change_order_company_fkey
    foreign key (change_order_id, company_id)
    references public.change_orders(id, company_id)
    on delete cascade
);

create index if not exists idx_change_order_line_items_change_order_sort
  on public.change_order_line_items(change_order_id, sort_order);

create table if not exists public.change_order_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  change_order_id uuid not null,
  note text not null,
  visibility text not null default 'internal',
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint change_order_notes_note_not_blank_check
    check (btrim(note) <> ''),

  constraint change_order_notes_visibility_check
    check (visibility in ('internal', 'customer')),

  constraint change_order_notes_change_order_company_fkey
    foreign key (change_order_id, company_id)
    references public.change_orders(id, company_id)
    on delete cascade
);

create index if not exists idx_change_order_notes_change_order_created_at
  on public.change_order_notes(change_order_id, created_at desc);

create table if not exists public.change_order_activity (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  change_order_id uuid not null,
  activity_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint change_order_activity_type_check
    check (
      activity_type in (
        'created',
        'updated',
        'submitted',
        'approved',
        'rejected',
        'reopened',
        'invoiced',
        'archived',
        'restored',
        'status_changed',
        'note_added'
      )
    ),

  constraint change_order_activity_description_not_blank_check
    check (btrim(description) <> ''),

  constraint change_order_activity_change_order_company_fkey
    foreign key (change_order_id, company_id)
    references public.change_orders(id, company_id)
    on delete cascade
);

create index if not exists idx_change_order_activity_change_order_created_at
  on public.change_order_activity(change_order_id, created_at desc);

create table if not exists public.change_order_invoice_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  change_order_id uuid not null,
  invoice_id uuid not null,
  link_type text not null default 'manual',
  amount_applied numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint change_order_invoice_links_type_check
    check (link_type in ('manual', 'converted', 'partial')),

  constraint change_order_invoice_links_amount_applied_check
    check (amount_applied >= 0),

  constraint change_order_invoice_links_unique
    unique (change_order_id, invoice_id),

  constraint change_order_invoice_links_change_order_company_fkey
    foreign key (change_order_id, company_id)
    references public.change_orders(id, company_id)
    on delete cascade,

  constraint change_order_invoice_links_invoice_company_fkey
    foreign key (invoice_id, company_id)
    references public.invoices(id, company_id)
    on delete cascade
);

create index if not exists idx_change_order_invoice_links_change_order
  on public.change_order_invoice_links(change_order_id);

create index if not exists idx_change_order_invoice_links_invoice
  on public.change_order_invoice_links(invoice_id);

-- Concurrency-safe number allocation per company.
create table if not exists public.company_change_order_sequences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  prefix text not null default 'CO-',
  padding integer not null default 4,
  next_number bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_change_order_sequences_prefix_not_blank_check
    check (btrim(prefix) <> ''),

  constraint company_change_order_sequences_padding_check
    check (padding between 1 and 12),

  constraint company_change_order_sequences_next_number_check
    check (next_number >= 1)
);

create or replace function public.allocate_change_order_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocated bigint;
  v_prefix text;
  v_padding integer;
  v_year text;
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
    insert into public.company_change_order_sequences (company_id, prefix, padding, next_number)
    values (p_company_id, 'CO-', 4, 2)
    on conflict (company_id)
    do update
      set next_number = public.company_change_order_sequences.next_number + 1,
          updated_at = now()
    returning next_number, prefix, padding
  )
  select next_number - 1, prefix, padding
    into v_allocated, v_prefix, v_padding
  from upserted;

  v_year := to_char(current_date, 'YYYY');
  return v_prefix || v_year || '-' || lpad(v_allocated::text, v_padding, '0');
end;
$$;

create or replace function public.recalc_change_order_totals(p_change_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subtotal numeric(14,2);
  v_tax_rate numeric(8,4);
  v_tax_amount numeric(14,2);
  v_total numeric(14,2);
begin
  if p_change_order_id is null then
    return;
  end if;

  select coalesce(sum(li.price_amount), 0)
    into v_subtotal
  from public.change_order_line_items li
  where li.change_order_id = p_change_order_id;

  select coalesce(co.tax_rate, 0)
    into v_tax_rate
  from public.change_orders co
  where co.id = p_change_order_id;

  if not found then
    return;
  end if;

  v_tax_amount := round(v_subtotal * v_tax_rate, 2);
  v_total := round(v_subtotal + v_tax_amount, 2);

  update public.change_orders co
     set subtotal = v_subtotal,
         tax_amount = v_tax_amount,
         total_amount = v_total,
         updated_at = now()
   where co.id = p_change_order_id;
end;
$$;

create or replace function public.trg_change_order_line_items_recalc_totals_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.recalc_change_order_totals(coalesce(new.change_order_id, old.change_order_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_change_order_line_items_recalc_totals on public.change_order_line_items;
create trigger trg_change_order_line_items_recalc_totals
after insert or update or delete on public.change_order_line_items
for each row execute function public.trg_change_order_line_items_recalc_totals_fn();

create or replace function public.trg_change_orders_recalc_totals_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_subtotal numeric(14,2);
  v_tax_rate numeric(8,4);
begin
  v_subtotal := coalesce(new.subtotal, 0);
  v_tax_rate := greatest(coalesce(new.tax_rate, 0), 0);
  new.tax_amount := round(v_subtotal * v_tax_rate, 2);
  new.total_amount := round(v_subtotal + new.tax_amount, 2);
  return new;
end;
$$;

drop trigger if exists trg_change_orders_recalc_totals on public.change_orders;
create trigger trg_change_orders_recalc_totals
before insert or update on public.change_orders
for each row execute function public.trg_change_orders_recalc_totals_fn();

alter table public.change_orders enable row level security;
alter table public.change_order_line_items enable row level security;
alter table public.change_order_notes enable row level security;
alter table public.change_order_activity enable row level security;
alter table public.change_order_invoice_links enable row level security;
alter table public.company_change_order_sequences enable row level security;

drop policy if exists change_orders_select on public.change_orders;
drop policy if exists change_orders_insert on public.change_orders;
drop policy if exists change_orders_update on public.change_orders;
drop policy if exists change_orders_delete on public.change_orders;

create policy change_orders_select
on public.change_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_orders.company_id
  )
);

create policy change_orders_insert
on public.change_orders
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_orders.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = change_orders.project_id
      and pr.company_id = change_orders.company_id
  )
  and (
    change_orders.customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = change_orders.customer_id
        and c.company_id = change_orders.company_id
    )
  )
  and (
    change_orders.estimate_id is null
    or exists (
      select 1
      from public.estimates e
      where e.id = change_orders.estimate_id
        and e.company_id = change_orders.company_id
    )
  )
  and (
    change_orders.invoice_id is null
    or exists (
      select 1
      from public.invoices i
      where i.id = change_orders.invoice_id
        and i.company_id = change_orders.company_id
    )
  )
);

create policy change_orders_update
on public.change_orders
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_orders.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_orders.company_id
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = change_orders.project_id
      and pr.company_id = change_orders.company_id
  )
  and (
    change_orders.customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = change_orders.customer_id
        and c.company_id = change_orders.company_id
    )
  )
  and (
    change_orders.estimate_id is null
    or exists (
      select 1
      from public.estimates e
      where e.id = change_orders.estimate_id
        and e.company_id = change_orders.company_id
    )
  )
  and (
    change_orders.invoice_id is null
    or exists (
      select 1
      from public.invoices i
      where i.id = change_orders.invoice_id
        and i.company_id = change_orders.company_id
    )
  )
);

create policy change_orders_delete
on public.change_orders
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_orders.company_id
  )
);

drop policy if exists change_order_line_items_select on public.change_order_line_items;
drop policy if exists change_order_line_items_insert on public.change_order_line_items;
drop policy if exists change_order_line_items_update on public.change_order_line_items;
drop policy if exists change_order_line_items_delete on public.change_order_line_items;

create policy change_order_line_items_select
on public.change_order_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_line_items.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_line_items.change_order_id
      and co.company_id = change_order_line_items.company_id
  )
);

create policy change_order_line_items_insert
on public.change_order_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_line_items.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_line_items.change_order_id
      and co.company_id = change_order_line_items.company_id
  )
);

create policy change_order_line_items_update
on public.change_order_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_line_items.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_line_items.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_line_items.change_order_id
      and co.company_id = change_order_line_items.company_id
  )
);

create policy change_order_line_items_delete
on public.change_order_line_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_line_items.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_line_items.change_order_id
      and co.company_id = change_order_line_items.company_id
  )
);

drop policy if exists change_order_notes_select on public.change_order_notes;
drop policy if exists change_order_notes_insert on public.change_order_notes;
drop policy if exists change_order_notes_update on public.change_order_notes;
drop policy if exists change_order_notes_delete on public.change_order_notes;

create policy change_order_notes_select
on public.change_order_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_notes.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_notes.change_order_id
      and co.company_id = change_order_notes.company_id
  )
);

create policy change_order_notes_insert
on public.change_order_notes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_notes.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_notes.change_order_id
      and co.company_id = change_order_notes.company_id
  )
);

create policy change_order_notes_update
on public.change_order_notes
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_notes.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_notes.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_notes.change_order_id
      and co.company_id = change_order_notes.company_id
  )
);

create policy change_order_notes_delete
on public.change_order_notes
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_notes.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_notes.change_order_id
      and co.company_id = change_order_notes.company_id
  )
);

drop policy if exists change_order_activity_select on public.change_order_activity;
drop policy if exists change_order_activity_insert on public.change_order_activity;
drop policy if exists change_order_activity_update on public.change_order_activity;
drop policy if exists change_order_activity_delete on public.change_order_activity;

create policy change_order_activity_select
on public.change_order_activity
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_activity.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_activity.change_order_id
      and co.company_id = change_order_activity.company_id
  )
);

create policy change_order_activity_insert
on public.change_order_activity
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_activity.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_activity.change_order_id
      and co.company_id = change_order_activity.company_id
  )
);

create policy change_order_activity_update
on public.change_order_activity
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_activity.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_activity.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_activity.change_order_id
      and co.company_id = change_order_activity.company_id
  )
);

create policy change_order_activity_delete
on public.change_order_activity
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_activity.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_activity.change_order_id
      and co.company_id = change_order_activity.company_id
  )
);

drop policy if exists change_order_invoice_links_select on public.change_order_invoice_links;
drop policy if exists change_order_invoice_links_insert on public.change_order_invoice_links;
drop policy if exists change_order_invoice_links_update on public.change_order_invoice_links;
drop policy if exists change_order_invoice_links_delete on public.change_order_invoice_links;

create policy change_order_invoice_links_select
on public.change_order_invoice_links
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_invoice_links.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_invoice_links.change_order_id
      and co.company_id = change_order_invoice_links.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = change_order_invoice_links.invoice_id
      and i.company_id = change_order_invoice_links.company_id
  )
);

create policy change_order_invoice_links_insert
on public.change_order_invoice_links
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_invoice_links.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_invoice_links.change_order_id
      and co.company_id = change_order_invoice_links.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = change_order_invoice_links.invoice_id
      and i.company_id = change_order_invoice_links.company_id
  )
);

create policy change_order_invoice_links_update
on public.change_order_invoice_links
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_invoice_links.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_invoice_links.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_invoice_links.change_order_id
      and co.company_id = change_order_invoice_links.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = change_order_invoice_links.invoice_id
      and i.company_id = change_order_invoice_links.company_id
  )
);

create policy change_order_invoice_links_delete
on public.change_order_invoice_links
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = change_order_invoice_links.company_id
  )
  and exists (
    select 1
    from public.change_orders co
    where co.id = change_order_invoice_links.change_order_id
      and co.company_id = change_order_invoice_links.company_id
  )
);

-- Sequence rows are intentionally private; allocation happens via function.
drop policy if exists company_change_order_sequences_select on public.company_change_order_sequences;
drop policy if exists company_change_order_sequences_insert on public.company_change_order_sequences;
drop policy if exists company_change_order_sequences_update on public.company_change_order_sequences;
drop policy if exists company_change_order_sequences_delete on public.company_change_order_sequences;

-- Reuse existing updated_at trigger function from current schema.
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
      and c.relname = 'change_orders'
      and t.tgname = 'trg_change_orders_set_updated_at'
  ) then
    execute format(
      'create trigger trg_change_orders_set_updated_at before update on public.change_orders for each row execute function %s;',
      v_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'change_order_line_items'
      and t.tgname = 'trg_change_order_line_items_set_updated_at'
  ) then
    execute format(
      'create trigger trg_change_order_line_items_set_updated_at before update on public.change_order_line_items for each row execute function %s;',
      v_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'change_order_notes'
      and t.tgname = 'trg_change_order_notes_set_updated_at'
  ) then
    execute format(
      'create trigger trg_change_order_notes_set_updated_at before update on public.change_order_notes for each row execute function %s;',
      v_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'company_change_order_sequences'
      and t.tgname = 'trg_company_change_order_sequences_set_updated_at'
  ) then
    execute format(
      'create trigger trg_company_change_order_sequences_set_updated_at before update on public.company_change_order_sequences for each row execute function %s;',
      v_fn
    );
  end if;
end $$;

commit;

begin;

alter table public.invoices
  add column if not exists prepared_by uuid null references public.profiles(id) on delete set null,
  add column if not exists estimate_id uuid null,
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric(14,2) not null default 0,
  add column if not exists discount_total numeric(14,2) not null default 0,
  add column if not exists additional_fee numeric(14,2) not null default 0,
  add column if not exists notes text null,
  add column if not exists payment_terms text null,
  add column if not exists sent_at timestamptz null,
  add column if not exists viewed_at timestamptz null,
  add column if not exists archived_at timestamptz null,
  add column if not exists created_by uuid null references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid null references public.profiles(id) on delete set null;

-- Ensure pair (id, company_id) can be referenced by composite foreign keys.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_id_company_unique'
  ) then
    alter table public.invoices
      add constraint invoices_id_company_unique unique (id, company_id);
  end if;
end $$;

alter table public.invoices
  drop constraint if exists invoices_status_check,
  add constraint invoices_status_check
    check (
      status in (
        'draft',
        'sent',
        'viewed',
        'partial',
        'partially_paid',
        'paid',
        'overdue',
        'void'
      )
    )
    not valid;

alter table public.invoices
  drop constraint if exists invoices_discount_type_check,
  add constraint invoices_discount_type_check
    check (discount_type in ('none', 'percentage', 'fixed'))
    not valid;

alter table public.invoices
  drop constraint if exists invoices_subtotal_check,
  add constraint invoices_subtotal_check
    check (subtotal >= 0)
    not valid;

alter table public.invoices
  drop constraint if exists invoices_tax_rate_check,
  add constraint invoices_tax_rate_check
    check (tax_rate >= 0)
    not valid;

alter table public.invoices
  drop constraint if exists invoices_tax_amount_check,
  add constraint invoices_tax_amount_check
    check (tax_amount >= 0)
    not valid;

alter table public.invoices
  drop constraint if exists invoices_discount_value_check,
  add constraint invoices_discount_value_check
    check (discount_value >= 0)
    not valid;

alter table public.invoices
  drop constraint if exists invoices_discount_total_check,
  add constraint invoices_discount_total_check
    check (discount_total >= 0)
    not valid;

alter table public.invoices
  drop constraint if exists invoices_additional_fee_check,
  add constraint invoices_additional_fee_check
    check (additional_fee >= 0)
    not valid;

alter table public.invoices
  drop constraint if exists invoices_total_amount_check,
  add constraint invoices_total_amount_check
    check (total_amount >= 0)
    not valid;

alter table public.invoices
  drop constraint if exists invoices_amount_paid_check,
  add constraint invoices_amount_paid_check
    check (amount_paid >= 0)
    not valid;

alter table public.invoices
  drop constraint if exists invoices_amount_paid_lte_total_check,
  add constraint invoices_amount_paid_lte_total_check
    check (amount_paid <= total_amount)
    not valid;

-- Scope estimate relationship by company.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_estimate_company_fkey'
  ) then
    alter table public.invoices
      add constraint invoices_estimate_company_fkey
        foreign key (estimate_id, company_id)
        references public.estimates(id, company_id)
        on delete set null;
  end if;
end $$;

create index if not exists idx_invoices_company_status_due_date
  on public.invoices(company_id, status, due_date);

create index if not exists idx_invoices_company_customer
  on public.invoices(company_id, customer_id);

create index if not exists idx_invoices_company_project
  on public.invoices(company_id, project_id);

create index if not exists idx_invoices_company_invoice_number
  on public.invoices(company_id, invoice_number);

create index if not exists idx_invoices_company_archived_at
  on public.invoices(company_id, archived_at);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null,
  sort_order integer not null default 1000,
  description text not null,
  quantity numeric(14,4) not null default 0,
  unit text not null default 'each',
  rate numeric(14,4) not null default 0,
  amount numeric(14,4) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoice_line_items_sort_order_check
    check (sort_order >= 0),

  constraint invoice_line_items_description_not_blank_check
    check (btrim(description) <> ''),

  constraint invoice_line_items_quantity_check
    check (quantity >= 0),

  constraint invoice_line_items_rate_check
    check (rate >= 0),

  constraint invoice_line_items_amount_check
    check (amount >= 0),

  constraint invoice_line_items_unit_check
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

  constraint invoice_line_items_invoice_company_fkey
    foreign key (invoice_id, company_id)
    references public.invoices(id, company_id)
    on delete cascade
);

create index if not exists idx_invoice_line_items_invoice_sort_order
  on public.invoice_line_items(invoice_id, sort_order);

create index if not exists idx_invoice_line_items_company_id
  on public.invoice_line_items(company_id);

alter table public.invoice_line_items enable row level security;

drop policy if exists invoice_line_items_select on public.invoice_line_items;
drop policy if exists invoice_line_items_insert on public.invoice_line_items;
drop policy if exists invoice_line_items_update on public.invoice_line_items;
drop policy if exists invoice_line_items_delete on public.invoice_line_items;

create policy invoice_line_items_select
on public.invoice_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_line_items.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and i.company_id = invoice_line_items.company_id
  )
);

create policy invoice_line_items_insert
on public.invoice_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_line_items.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and i.company_id = invoice_line_items.company_id
  )
);

create policy invoice_line_items_update
on public.invoice_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_line_items.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_line_items.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and i.company_id = invoice_line_items.company_id
  )
);

create policy invoice_line_items_delete
on public.invoice_line_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_line_items.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and i.company_id = invoice_line_items.company_id
  )
);

create table if not exists public.invoice_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null,
  note text not null,
  visibility text not null default 'internal',
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoice_notes_note_not_blank_check
    check (btrim(note) <> ''),

  constraint invoice_notes_visibility_check
    check (visibility in ('internal', 'customer')),

  constraint invoice_notes_invoice_company_fkey
    foreign key (invoice_id, company_id)
    references public.invoices(id, company_id)
    on delete cascade
);

create index if not exists idx_invoice_notes_invoice_created_at
  on public.invoice_notes(invoice_id, created_at desc);

create index if not exists idx_invoice_notes_company_id
  on public.invoice_notes(company_id);

alter table public.invoice_notes enable row level security;

drop policy if exists invoice_notes_select on public.invoice_notes;
drop policy if exists invoice_notes_insert on public.invoice_notes;
drop policy if exists invoice_notes_update on public.invoice_notes;
drop policy if exists invoice_notes_delete on public.invoice_notes;

create policy invoice_notes_select
on public.invoice_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_notes.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_notes.invoice_id
      and i.company_id = invoice_notes.company_id
  )
);

create policy invoice_notes_insert
on public.invoice_notes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_notes.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_notes.invoice_id
      and i.company_id = invoice_notes.company_id
  )
);

create policy invoice_notes_update
on public.invoice_notes
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_notes.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_notes.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_notes.invoice_id
      and i.company_id = invoice_notes.company_id
  )
);

create policy invoice_notes_delete
on public.invoice_notes
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_notes.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_notes.invoice_id
      and i.company_id = invoice_notes.company_id
  )
);

create table if not exists public.invoice_payment_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null,
  payment_date date not null,
  amount numeric(14,2) not null,
  method text null,
  reference_number text null,
  status text not null default 'recorded',
  notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoice_payment_history_amount_check
    check (amount >= 0),

  constraint invoice_payment_history_status_check
    check (status in ('recorded', 'pending', 'failed', 'voided')),

  constraint invoice_payment_history_invoice_company_fkey
    foreign key (invoice_id, company_id)
    references public.invoices(id, company_id)
    on delete cascade
);

create index if not exists idx_invoice_payment_history_invoice_date
  on public.invoice_payment_history(invoice_id, payment_date desc);

create index if not exists idx_invoice_payment_history_company_id
  on public.invoice_payment_history(company_id);

alter table public.invoice_payment_history enable row level security;

drop policy if exists invoice_payment_history_select on public.invoice_payment_history;
drop policy if exists invoice_payment_history_insert on public.invoice_payment_history;
drop policy if exists invoice_payment_history_update on public.invoice_payment_history;
drop policy if exists invoice_payment_history_delete on public.invoice_payment_history;

create policy invoice_payment_history_select
on public.invoice_payment_history
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_payment_history.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_payment_history.invoice_id
      and i.company_id = invoice_payment_history.company_id
  )
);

create policy invoice_payment_history_insert
on public.invoice_payment_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_payment_history.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_payment_history.invoice_id
      and i.company_id = invoice_payment_history.company_id
  )
);

create policy invoice_payment_history_update
on public.invoice_payment_history
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_payment_history.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_payment_history.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_payment_history.invoice_id
      and i.company_id = invoice_payment_history.company_id
  )
);

create policy invoice_payment_history_delete
on public.invoice_payment_history
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_payment_history.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_payment_history.invoice_id
      and i.company_id = invoice_payment_history.company_id
  )
);

create table if not exists public.invoice_estimate_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null,
  estimate_id uuid not null,
  link_type text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint invoice_estimate_links_link_type_check
    check (link_type in ('manual', 'converted')),

  constraint invoice_estimate_links_unique_invoice_estimate
    unique (invoice_id, estimate_id),

  constraint invoice_estimate_links_invoice_company_fkey
    foreign key (invoice_id, company_id)
    references public.invoices(id, company_id)
    on delete cascade,

  constraint invoice_estimate_links_estimate_company_fkey
    foreign key (estimate_id, company_id)
    references public.estimates(id, company_id)
    on delete cascade
);

create index if not exists idx_invoice_estimate_links_company_id
  on public.invoice_estimate_links(company_id);

create index if not exists idx_invoice_estimate_links_estimate_id
  on public.invoice_estimate_links(estimate_id);

alter table public.invoice_estimate_links enable row level security;

drop policy if exists invoice_estimate_links_select on public.invoice_estimate_links;
drop policy if exists invoice_estimate_links_insert on public.invoice_estimate_links;
drop policy if exists invoice_estimate_links_update on public.invoice_estimate_links;
drop policy if exists invoice_estimate_links_delete on public.invoice_estimate_links;

create policy invoice_estimate_links_select
on public.invoice_estimate_links
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_estimate_links.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_estimate_links.invoice_id
      and i.company_id = invoice_estimate_links.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = invoice_estimate_links.estimate_id
      and e.company_id = invoice_estimate_links.company_id
  )
);

create policy invoice_estimate_links_insert
on public.invoice_estimate_links
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_estimate_links.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_estimate_links.invoice_id
      and i.company_id = invoice_estimate_links.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = invoice_estimate_links.estimate_id
      and e.company_id = invoice_estimate_links.company_id
  )
);

create policy invoice_estimate_links_update
on public.invoice_estimate_links
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_estimate_links.company_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_estimate_links.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_estimate_links.invoice_id
      and i.company_id = invoice_estimate_links.company_id
  )
  and exists (
    select 1
    from public.estimates e
    where e.id = invoice_estimate_links.estimate_id
      and e.company_id = invoice_estimate_links.company_id
  )
);

create policy invoice_estimate_links_delete
on public.invoice_estimate_links
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = invoice_estimate_links.company_id
  )
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_estimate_links.invoice_id
      and i.company_id = invoice_estimate_links.company_id
  )
);

create or replace function public.trg_invoice_payment_history_sync_invoice_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_invoice_id uuid;
  v_company_id uuid;
  v_total_paid numeric(14,2);
  v_invoice_total numeric(14,2);
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  v_company_id := coalesce(new.company_id, old.company_id);

  select coalesce(sum(ph.amount), 0)
    into v_total_paid
  from public.invoice_payment_history ph
  where ph.invoice_id = v_invoice_id
    and ph.company_id = v_company_id
    and ph.status in ('recorded', 'pending');

  select i.total_amount
    into v_invoice_total
  from public.invoices i
  where i.id = v_invoice_id
    and i.company_id = v_company_id;

  update public.invoices i
     set amount_paid = greatest(0, least(v_total_paid, coalesce(v_invoice_total, 0))),
         status = case
           when i.status = 'void' then 'void'
           when greatest(0, least(v_total_paid, coalesce(v_invoice_total, 0))) = 0 then
             case when i.status = 'draft' then 'draft' else 'sent' end
           when greatest(0, least(v_total_paid, coalesce(v_invoice_total, 0))) >= coalesce(v_invoice_total, 0) then 'paid'
           else 'partially_paid'
         end,
         paid_date = case
           when greatest(0, least(v_total_paid, coalesce(v_invoice_total, 0))) >= coalesce(v_invoice_total, 0)
             then coalesce(i.paid_date, current_date)
           else null
         end,
         updated_at = now()
   where i.id = v_invoice_id
     and i.company_id = v_company_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_invoice_payment_history_sync_invoice on public.invoice_payment_history;
create trigger trg_invoice_payment_history_sync_invoice
after insert or update or delete on public.invoice_payment_history
for each row execute function public.trg_invoice_payment_history_sync_invoice_fn();

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
      and c.relname = 'invoices'
      and t.tgname = 'trg_invoices_set_updated_at'
  ) then
    execute format(
      'create trigger trg_invoices_set_updated_at before update on public.invoices for each row execute function %s;',
      v_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'invoice_line_items'
      and t.tgname = 'trg_invoice_line_items_set_updated_at'
  ) then
    execute format(
      'create trigger trg_invoice_line_items_set_updated_at before update on public.invoice_line_items for each row execute function %s;',
      v_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'invoice_notes'
      and t.tgname = 'trg_invoice_notes_set_updated_at'
  ) then
    execute format(
      'create trigger trg_invoice_notes_set_updated_at before update on public.invoice_notes for each row execute function %s;',
      v_fn
    );
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'invoice_payment_history'
      and t.tgname = 'trg_invoice_payment_history_set_updated_at'
  ) then
    execute format(
      'create trigger trg_invoice_payment_history_set_updated_at before update on public.invoice_payment_history for each row execute function %s;',
      v_fn
    );
  end if;
end $$;

commit;

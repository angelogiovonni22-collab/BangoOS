begin;

create table if not exists public.company_estimate_sequences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  prefix text not null default 'EST-',
  padding integer not null default 6,
  next_number bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_estimate_sequences_prefix_not_blank_check
    check (btrim(prefix) <> ''),

  constraint company_estimate_sequences_padding_check
    check (padding between 1 and 12),

  constraint company_estimate_sequences_next_number_check
    check (next_number >= 1)
);

alter table public.company_estimate_sequences
  add column if not exists prefix text not null default 'EST-',
  add column if not exists padding integer not null default 6;

alter table public.company_estimate_sequences
  drop constraint if exists company_estimate_sequences_prefix_not_blank_check,
  add constraint company_estimate_sequences_prefix_not_blank_check
    check (btrim(prefix) <> '');

alter table public.company_estimate_sequences
  drop constraint if exists company_estimate_sequences_padding_check,
  add constraint company_estimate_sequences_padding_check
    check (padding between 1 and 12);

alter table public.company_estimate_sequences
  drop constraint if exists company_estimate_sequences_next_number_check,
  add constraint company_estimate_sequences_next_number_check
    check (next_number >= 1);

alter table public.company_estimate_sequences enable row level security;

drop policy if exists company_estimate_sequences_select on public.company_estimate_sequences;
drop policy if exists company_estimate_sequences_insert on public.company_estimate_sequences;
drop policy if exists company_estimate_sequences_update on public.company_estimate_sequences;

-- Sequence rows are not directly readable or mutable by authenticated clients.
-- Allocation occurs through public.allocate_estimate_number only.

create or replace function public.round_money(p_value numeric)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select round(coalesce(p_value, 0), 2)
$$;

create or replace function public.allocate_estimate_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocated bigint;
  v_prefix text;
  v_padding integer;
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
    insert into public.company_estimate_sequences (company_id, prefix, padding, next_number)
    values (p_company_id, 'EST-', 6, 2)
    on conflict (company_id)
    do update
      set next_number = public.company_estimate_sequences.next_number + 1,
          updated_at = now()
    returning next_number, prefix, padding
  )
  select next_number - 1, prefix, padding
    into v_allocated, v_prefix, v_padding
  from upserted;

  return v_prefix || lpad(v_allocated::text, v_padding, '0');
end;
$$;

create or replace function public.recalc_estimate_totals(p_estimate_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subtotal numeric := 0;
  v_internal_cost_total numeric := 0;
  v_discount_type text;
  v_discount_value numeric;
  v_tax_rate numeric;
  v_discount_amount numeric := 0;
  v_taxable_subtotal numeric := 0;
  v_taxable_subtotal_after_discount numeric := 0;
  v_tax_amount numeric := 0;
  v_total_amount numeric := 0;
  v_gross_profit numeric := 0;
  v_gross_margin_percent numeric := 0;
  v_taxable_discount_share numeric := 0;
begin
  if p_estimate_id is null then
    return;
  end if;

  select
    coalesce(sum(case when s.customer_visible then s.section_subtotal else 0 end), 0),
    coalesce(sum(s.section_internal_cost), 0)
  into v_subtotal, v_internal_cost_total
  from public.estimate_sections s
  where s.estimate_id = p_estimate_id
    and s.deleted_at is null;

  select e.discount_type, e.discount_value, e.tax_rate
  into v_discount_type, v_discount_value, v_tax_rate
  from public.estimates e
  where e.id = p_estimate_id;

  if not found then
    return;
  end if;

  if v_discount_type = 'percentage' then
    v_discount_amount := public.round_money(v_subtotal * (coalesce(v_discount_value, 0) / 100.0));
  elsif v_discount_type = 'fixed' then
    v_discount_amount := least(public.round_money(coalesce(v_discount_value, 0)), public.round_money(v_subtotal));
  else
    v_discount_amount := 0;
  end if;

  select coalesce(sum(i.customer_line_total), 0)
    into v_taxable_subtotal
  from public.estimate_items i
  join public.estimate_sections s on s.id = i.section_id
  where i.estimate_id = p_estimate_id
    and i.deleted_at is null
    and s.deleted_at is null
    and s.customer_visible
    and i.customer_visible
    and i.taxable
    and i.item_type <> 'discount';

  if v_subtotal > 0 then
    v_taxable_discount_share := public.round_money(v_discount_amount * (v_taxable_subtotal / v_subtotal));
  else
    v_taxable_discount_share := 0;
  end if;

  v_taxable_subtotal_after_discount := greatest(public.round_money(v_taxable_subtotal - v_taxable_discount_share), 0);
  v_tax_amount := public.round_money(v_taxable_subtotal_after_discount * coalesce(v_tax_rate, 0));
  v_total_amount := public.round_money(greatest(v_subtotal - v_discount_amount, 0) + v_tax_amount);
  v_gross_profit := public.round_money(v_total_amount - v_internal_cost_total);

  if v_total_amount > 0 then
    v_gross_margin_percent := round((v_gross_profit / v_total_amount) * 100.0, 6);
  else
    v_gross_margin_percent := 0;
  end if;

  update public.estimates e
     set subtotal = public.round_money(v_subtotal),
         discount_amount = public.round_money(v_discount_amount),
         tax_amount = public.round_money(v_tax_amount),
         total_amount = public.round_money(v_total_amount),
         internal_cost_total = public.round_money(v_internal_cost_total),
         gross_profit = public.round_money(v_gross_profit),
         gross_margin_percent = v_gross_margin_percent,
         updated_at = now()
   where e.id = p_estimate_id;
end;
$$;

create or replace function public.recalc_estimate_section_totals(p_section_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_estimate_id uuid;
  v_section_subtotal numeric := 0;
  v_section_internal_cost numeric := 0;
begin
  if p_section_id is null then
    return;
  end if;

  select s.estimate_id
    into v_estimate_id
  from public.estimate_sections s
  where s.id = p_section_id;

  if not found then
    return;
  end if;

  select
    coalesce(sum(case when i.customer_visible then i.customer_line_total else 0 end), 0),
    coalesce(sum(i.internal_cost_total), 0)
  into v_section_subtotal, v_section_internal_cost
  from public.estimate_items i
  where i.section_id = p_section_id
    and i.deleted_at is null;

  update public.estimate_sections s
     set section_subtotal = public.round_money(v_section_subtotal),
         section_internal_cost = public.round_money(v_section_internal_cost),
         updated_at = now()
   where s.id = p_section_id;

  perform public.recalc_estimate_totals(v_estimate_id);
end;
$$;

create or replace function public.recalc_estimate_item_fields(p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_section_id uuid;
  v_estimate_id uuid;
  v_customer_unit_price numeric;
  v_item_type text;
  v_quantity numeric;
  v_material_cost numeric;
  v_labor_hours numeric;
  v_labor_rate numeric;
  v_equipment_cost numeric;
  v_subcontractor_cost numeric;
  v_other_cost numeric;
  v_markup_type text;
  v_markup_value numeric;
  v_labor_cost numeric := 0;
  v_internal_cost_total numeric := 0;
  v_suggested_unit_price numeric := 0;
  v_customer_line_total numeric := 0;
begin
  if p_item_id is null then
    return;
  end if;

  select
    i.section_id,
    i.estimate_id,
    i.item_type,
    i.quantity,
    i.customer_unit_price,
    i.material_cost,
    i.labor_hours,
    i.labor_rate,
    i.equipment_cost,
    i.subcontractor_cost,
    i.other_cost,
    i.markup_type,
    i.markup_value
  into
    v_section_id,
    v_estimate_id,
    v_item_type,
    v_quantity,
    v_customer_unit_price,
    v_material_cost,
    v_labor_hours,
    v_labor_rate,
    v_equipment_cost,
    v_subcontractor_cost,
    v_other_cost,
    v_markup_type,
    v_markup_value
  from public.estimate_items i
  where i.id = p_item_id;

  if not found then
    return;
  end if;

  v_labor_cost := public.round_money(coalesce(v_labor_hours, 0) * coalesce(v_labor_rate, 0));

  v_internal_cost_total := public.round_money(
    coalesce(v_material_cost, 0)
    + v_labor_cost
    + coalesce(v_equipment_cost, 0)
    + coalesce(v_subcontractor_cost, 0)
    + coalesce(v_other_cost, 0)
  );

  if v_markup_type = 'percentage' then
    v_suggested_unit_price := public.round_money(v_internal_cost_total * (1 + (coalesce(v_markup_value, 0) / 100.0)));
  elsif v_markup_type = 'fixed' then
    v_suggested_unit_price := public.round_money(v_internal_cost_total + coalesce(v_markup_value, 0));
  else
    v_suggested_unit_price := public.round_money(v_internal_cost_total);
  end if;

  -- Sprint 1 canonical behavior: any non-null customer_unit_price is authoritative.
  -- This schema currently defines customer_unit_price as NOT NULL, so suggestion logic
  -- only applies if nulls are introduced by future schema changes.
  if v_customer_unit_price is null then
    v_customer_unit_price := v_suggested_unit_price;
  end if;

  v_customer_line_total := public.round_money(coalesce(v_quantity, 0) * v_customer_unit_price);

  if v_item_type = 'discount' then
    v_customer_line_total := -abs(v_customer_line_total);
  else
    v_customer_line_total := greatest(v_customer_line_total, 0);
  end if;

  update public.estimate_items i
     set labor_cost = v_labor_cost,
         internal_cost_total = v_internal_cost_total,
         customer_unit_price = v_customer_unit_price,
         customer_line_total = v_customer_line_total,
         updated_at = now()
   where i.id = p_item_id;

  perform public.recalc_estimate_section_totals(v_section_id);
end;
$$;

create or replace function public.reorder_estimate_sections(
  p_estimate_id uuid,
  p_section_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_active_count integer;
  v_input_count integer;
  v_distinct_count integer;
begin
  if p_estimate_id is null then
    raise exception 'Estimate id is required';
  end if;

  if p_section_ids is null then
    raise exception 'Section id list is required';
  end if;

  v_input_count := cardinality(p_section_ids);

  if v_input_count = 0 then
    raise exception 'Section id list cannot be empty';
  end if;

  select count(distinct u.id)
    into v_distinct_count
  from unnest(p_section_ids) as u(id);

  if v_distinct_count <> v_input_count then
    raise exception 'Section id list contains duplicates';
  end if;

  -- Serialize section reorder operations for this estimate.
  select e.company_id
    into v_company_id
  from public.estimates e
  where e.id = p_estimate_id
    and e.deleted_at is null
  for update;

  if not found then
    raise exception 'Estimate not found or deleted: %', p_estimate_id;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = v_company_id
  ) then
    raise exception 'Not authorized for estimate %', p_estimate_id;
  end if;

  select count(*)
    into v_active_count
  from public.estimate_sections s
  where s.estimate_id = p_estimate_id
    and s.deleted_at is null;

  if v_active_count <> v_input_count then
    raise exception
      'Section id list must contain every active section exactly once. expected %, received %',
      v_active_count,
      v_input_count;
  end if;

  if exists (
    select 1
    from unnest(p_section_ids) as u(id)
    left join public.estimate_sections s
      on s.id = u.id
     and s.estimate_id = p_estimate_id
     and s.deleted_at is null
    where s.id is null
  ) then
    raise exception 'Section id list contains ids that are missing, deleted, or outside this estimate';
  end if;

  if exists (
    select 1
    from public.estimate_sections s
    where s.estimate_id = p_estimate_id
      and s.deleted_at is null
      and not (s.id = any(p_section_ids))
  ) then
    raise exception 'Section id list is incomplete for active estimate sections';
  end if;

  update public.estimate_sections s
     set sort_order = (u.ord::integer) * 1000,
         updated_at = now()
    from unnest(p_section_ids) with ordinality as u(id, ord)
   where s.id = u.id
     and s.estimate_id = p_estimate_id
     and s.deleted_at is null;
end;
$$;

create or replace function public.reorder_estimate_items(
  p_estimate_id uuid,
  p_section_id uuid,
  p_item_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_active_count integer;
  v_input_count integer;
  v_distinct_count integer;
begin
  if p_estimate_id is null then
    raise exception 'Estimate id is required';
  end if;

  if p_section_id is null then
    raise exception 'Section id is required';
  end if;

  if p_item_ids is null then
    raise exception 'Item id list is required';
  end if;

  v_input_count := cardinality(p_item_ids);

  if v_input_count = 0 then
    raise exception 'Item id list cannot be empty';
  end if;

  select count(distinct u.id)
    into v_distinct_count
  from unnest(p_item_ids) as u(id);

  if v_distinct_count <> v_input_count then
    raise exception 'Item id list contains duplicates';
  end if;

  -- Serialize item reorder operations for this section.
  select s.company_id
    into v_company_id
  from public.estimate_sections s
  join public.estimates e
    on e.id = s.estimate_id
  where s.id = p_section_id;
    and s.estimate_id = p_estimate_id
    and s.deleted_at is null
    and e.deleted_at is null
  for update;

  if not found then
    raise exception 'Section not found, deleted, or not part of estimate %: %', p_estimate_id, p_section_id;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = v_company_id
  ) then
    raise exception 'Not authorized for section %', p_section_id;
  end if;

  select count(*)
    into v_active_count
  from public.estimate_items i
  where i.section_id = p_section_id
    and i.estimate_id = p_estimate_id
    and i.company_id = v_company_id
    and i.deleted_at is null;

  if v_active_count <> v_input_count then
    raise exception
      'Item id list must contain every active item exactly once. expected %, received %',
      v_active_count,
      v_input_count;
  end if;

  if exists (
    select 1
    from unnest(p_item_ids) as u(id)
    left join public.estimate_items i
      on i.id = u.id
     and i.section_id = p_section_id
     and i.estimate_id = p_estimate_id
     and i.company_id = v_company_id
     and i.deleted_at is null
    where i.id is null
  ) then
    raise exception 'Item id list contains ids that are missing, deleted, or outside this section';
  end if;

  if exists (
    select 1
    from public.estimate_items i
    where i.section_id = p_section_id
      and i.estimate_id = p_estimate_id
      and i.company_id = v_company_id
      and i.deleted_at is null
      and not (i.id = any(p_item_ids))
  ) then
    raise exception 'Item id list is incomplete for active section items';
  end if;

  update public.estimate_items i
     set sort_order = (u.ord::integer) * 1000,
         updated_at = now()
    from unnest(p_item_ids) with ordinality as u(id, ord)
   where i.id = u.id
     and i.section_id = p_section_id
     and i.deleted_at is null;

  perform public.recalc_estimate_section_totals(p_section_id);
end;
$$;

revoke execute on function public.round_money(numeric) from public;
revoke execute on function public.allocate_estimate_number(uuid) from public;
revoke execute on function public.recalc_estimate_totals(uuid) from public;
revoke execute on function public.recalc_estimate_section_totals(uuid) from public;
revoke execute on function public.recalc_estimate_item_fields(uuid) from public;
revoke execute on function public.reorder_estimate_sections(uuid, uuid[]) from public;
revoke execute on function public.reorder_estimate_items(uuid, uuid, uuid[]) from public;

grant execute on function public.allocate_estimate_number(uuid) to authenticated;
grant execute on function public.allocate_estimate_number(uuid) to service_role;
grant execute on function public.reorder_estimate_sections(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_estimate_sections(uuid, uuid[]) to service_role;
grant execute on function public.reorder_estimate_items(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.reorder_estimate_items(uuid, uuid, uuid[]) to service_role;

-- Required for runtime trigger/recalc paths under SECURITY INVOKER functions.
grant execute on function public.round_money(numeric) to authenticated;
grant execute on function public.recalc_estimate_totals(uuid) to authenticated;
grant execute on function public.recalc_estimate_section_totals(uuid) to authenticated;
grant execute on function public.recalc_estimate_item_fields(uuid) to authenticated;

grant execute on function public.round_money(numeric) to service_role;
grant execute on function public.recalc_estimate_totals(uuid) to service_role;
grant execute on function public.recalc_estimate_section_totals(uuid) to service_role;
grant execute on function public.recalc_estimate_item_fields(uuid) to service_role;

commit;

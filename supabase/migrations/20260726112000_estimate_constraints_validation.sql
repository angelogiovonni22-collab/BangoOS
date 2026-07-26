begin;

-- Run this migration after estimates schema, RLS, functions, and triggers are in place.
-- This migration performs strict preflight checks before validating NOT VALID constraints.

do $$
declare
  v_invalid_statuses text;
  v_invalid_tax_rate_count bigint;
  v_blank_title_count bigint;
  v_invalid_currency_count bigint;
  v_blank_estimate_number_count bigint;
  v_non_draft_missing_number_count bigint;
  v_self_previous_count bigint;
  v_cross_company_previous_count bigint;
  v_cycle_found boolean := false;
begin
  select string_agg(distinct e.status, ', ' order by e.status)
    into v_invalid_statuses
  from public.estimates e
  where e.status not in (
    'draft',
    'ready',
    'sent',
    'viewed',
    'revision_requested',
    'approved',
    'rejected',
    'expired',
    'void',
    'superseded'
  );

  if v_invalid_statuses is not null then
    raise exception 'Cannot validate estimates_status_check. Invalid status values: %', v_invalid_statuses;
  end if;

  select count(*)
    into v_invalid_tax_rate_count
  from public.estimates e
  where e.tax_rate < 0 or e.tax_rate > 1;

  if v_invalid_tax_rate_count > 0 then
    raise exception 'Cannot validate estimates_tax_rate_check. Invalid tax_rate row count: %', v_invalid_tax_rate_count;
  end if;

  select count(*)
    into v_blank_title_count
  from public.estimates e
  where btrim(e.title) = '';

  if v_blank_title_count > 0 then
    raise exception 'Cannot validate estimates_title_not_blank_check. Blank title row count: %', v_blank_title_count;
  end if;

  select count(*)
    into v_invalid_currency_count
  from public.estimates e
  where e.currency_code !~ '^[A-Z]{3}$';

  if v_invalid_currency_count > 0 then
    raise exception 'Cannot validate estimates_currency_code_check. Invalid currency_code row count: %', v_invalid_currency_count;
  end if;

  select count(*)
    into v_blank_estimate_number_count
  from public.estimates e
  where e.estimate_number is not null
    and btrim(e.estimate_number) = '';

  if v_blank_estimate_number_count > 0 then
    raise exception 'Cannot validate estimates_number_not_blank_check. Blank estimate_number row count: %', v_blank_estimate_number_count;
  end if;

  select count(*)
    into v_non_draft_missing_number_count
  from public.estimates e
  where e.status <> 'draft'
    and e.estimate_number is null;

  if v_non_draft_missing_number_count > 0 then
    raise exception 'Cannot validate estimates_non_draft_requires_number_check. Non-draft rows missing estimate_number: %', v_non_draft_missing_number_count;
  end if;

  select count(*)
    into v_self_previous_count
  from public.estimates e
  where e.previous_estimate_id = e.id;

  if v_self_previous_count > 0 then
    raise exception 'Cannot validate estimates_previous_estimate_not_self_check. Self-referencing rows: %', v_self_previous_count;
  end if;

  select count(*)
    into v_cross_company_previous_count
  from public.estimates e
  join public.estimates p
    on p.id = e.previous_estimate_id
  where e.previous_estimate_id is not null
    and e.company_id <> p.company_id;

  if v_cross_company_previous_count > 0 then
    raise exception 'Cannot validate estimates_previous_estimate_id_fkey semantics. Cross-company previous_estimate_id rows: %', v_cross_company_previous_count;
  end if;

  with recursive chain as (
    select e.id as root_id, e.previous_estimate_id, e.id as current_id, 1 as depth
    from public.estimates e
    where e.previous_estimate_id is not null

    union all

    select c.root_id, p.previous_estimate_id, p.id as current_id, c.depth + 1
    from chain c
    join public.estimates p
      on p.id = c.previous_estimate_id
    where c.previous_estimate_id is not null
      and c.depth < 200
  )
  select exists (
    select 1
    from chain c
    where c.previous_estimate_id = c.root_id
  )
  into v_cycle_found;

  if v_cycle_found then
    raise exception 'Cannot validate revision chain constraints. At least one previous_estimate_id cycle exists.';
  end if;
end $$;

alter table public.estimates validate constraint estimates_previous_estimate_id_fkey;
alter table public.estimates validate constraint estimates_created_by_fkey;
alter table public.estimates validate constraint estimates_updated_by_fkey;
alter table public.estimates validate constraint estimates_deleted_by_fkey;
alter table public.estimates validate constraint estimates_version_number_check;
alter table public.estimates validate constraint estimates_previous_estimate_not_self_check;
alter table public.estimates validate constraint estimates_discount_value_check;
alter table public.estimates validate constraint estimates_discount_amount_check;
alter table public.estimates validate constraint estimates_tax_rate_check;
alter table public.estimates validate constraint estimates_currency_code_check;
alter table public.estimates validate constraint estimates_title_not_blank_check;
alter table public.estimates validate constraint estimates_number_not_blank_check;
alter table public.estimates validate constraint estimates_subtotal_check;
alter table public.estimates validate constraint estimates_tax_amount_check;
alter table public.estimates validate constraint estimates_total_amount_check;
alter table public.estimates validate constraint estimates_internal_cost_total_check;
alter table public.estimates validate constraint estimates_gross_margin_percent_check;
alter table public.estimates validate constraint estimates_status_check;
alter table public.estimates validate constraint estimates_discount_type_check;
alter table public.estimates validate constraint estimates_non_draft_requires_number_check;

commit;

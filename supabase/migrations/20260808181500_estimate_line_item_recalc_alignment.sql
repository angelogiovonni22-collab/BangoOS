begin;

create or replace function public.recalc_estimate_totals(p_estimate_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subtotal numeric := 0;
  v_internal_cost_total numeric := 0;
  v_markup_total numeric := 0;
  v_discount_type text;
  v_discount_value numeric;
  v_tax_rate numeric;
  v_additional_fee numeric := 0;
  v_discount_amount numeric := 0;
  v_taxable_subtotal numeric := 0;
  v_taxable_subtotal_after_discount numeric := 0;
  v_tax_amount numeric := 0;
  v_total_amount numeric := 0;
  v_gross_profit numeric := 0;
  v_gross_margin_percent numeric := 0;
  v_taxable_discount_share numeric := 0;
  v_has_legacy_sections boolean := false;
begin
  if p_estimate_id is null then
    return;
  end if;

  select e.discount_type, e.discount_value, e.tax_rate, e.additional_fee
  into v_discount_type, v_discount_value, v_tax_rate, v_additional_fee
  from public.estimates e
  where e.id = p_estimate_id;

  if not found then
    return;
  end if;

  select exists(
    select 1
    from public.estimate_sections s
    where s.estimate_id = p_estimate_id
      and s.deleted_at is null
  )
  into v_has_legacy_sections;

  if v_has_legacy_sections then
    select
      coalesce(sum(case when s.customer_visible then s.section_subtotal else 0 end), 0),
      coalesce(sum(s.section_internal_cost), 0)
    into v_subtotal, v_internal_cost_total
    from public.estimate_sections s
    where s.estimate_id = p_estimate_id
      and s.deleted_at is null;

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
  else
    select
      coalesce(sum(li.line_total), 0),
      coalesce(sum(li.quantity * li.unit_cost), 0)
    into v_subtotal, v_internal_cost_total
    from public.estimate_line_items li
    where li.estimate_id = p_estimate_id;

    v_taxable_subtotal := v_subtotal;
  end if;

  v_markup_total := public.round_money(greatest(v_subtotal - v_internal_cost_total, 0));

  if v_discount_type = 'percentage' then
    v_discount_amount := public.round_money(v_subtotal * (coalesce(v_discount_value, 0) / 100.0));
  elsif v_discount_type = 'fixed' then
    v_discount_amount := least(public.round_money(coalesce(v_discount_value, 0)), public.round_money(v_subtotal));
  else
    v_discount_amount := 0;
  end if;

  if v_subtotal > 0 then
    v_taxable_discount_share := public.round_money(v_discount_amount * (v_taxable_subtotal / v_subtotal));
  else
    v_taxable_discount_share := 0;
  end if;

  v_taxable_subtotal_after_discount := greatest(public.round_money(v_taxable_subtotal - v_taxable_discount_share), 0);
  v_tax_amount := public.round_money(v_taxable_subtotal_after_discount * coalesce(v_tax_rate, 0));
  v_total_amount := public.round_money(greatest(v_subtotal - v_discount_amount, 0) + v_tax_amount + coalesce(v_additional_fee, 0));
  v_gross_profit := public.round_money(v_total_amount - v_internal_cost_total);

  if v_total_amount > 0 then
    v_gross_margin_percent := round((v_gross_profit / v_total_amount) * 100.0, 6);
  else
    v_gross_margin_percent := 0;
  end if;

  update public.estimates e
     set direct_cost_subtotal = public.round_money(v_internal_cost_total),
         markup_total = v_markup_total,
         subtotal = public.round_money(v_subtotal),
         discount_amount = public.round_money(v_discount_amount),
         discount_total = public.round_money(v_discount_amount),
         tax_amount = public.round_money(v_tax_amount),
         total_amount = public.round_money(v_total_amount),
         internal_cost_total = public.round_money(v_internal_cost_total),
         gross_profit = public.round_money(v_gross_profit),
         gross_margin_percent = v_gross_margin_percent,
         updated_at = now()
   where e.id = p_estimate_id;
end;
$$;

commit;
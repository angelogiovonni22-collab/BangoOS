begin;

create or replace function public.recalculate_purchase_order_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_purchase_order_id uuid;
  target_company_id uuid;
begin
  target_purchase_order_id := coalesce(new.purchase_order_id, old.purchase_order_id);
  target_company_id := coalesce(new.company_id, old.company_id);

  update public.purchase_orders po
  set subtotal_amount = totals.subtotal_amount,
      total_amount = totals.subtotal_amount + po.tax_amount + po.shipping_amount,
      updated_at = now()
  from (
    select coalesce(sum(line_subtotal), 0)::numeric(14,2) as subtotal_amount
    from public.purchase_order_line_items
    where purchase_order_id = target_purchase_order_id
      and company_id = target_company_id
  ) totals
  where po.id = target_purchase_order_id
    and po.company_id = target_company_id;

  return coalesce(new, old);
end;
$$;

revoke all on function public.recalculate_purchase_order_totals() from public, anon, authenticated;

drop trigger if exists purchase_order_line_items_recalculate_totals on public.purchase_order_line_items;
create trigger purchase_order_line_items_recalculate_totals
after insert or update of quantity_ordered, unit_cost, line_subtotal or delete
on public.purchase_order_line_items
for each row execute function public.recalculate_purchase_order_totals();

update public.purchase_orders po
set subtotal_amount = totals.subtotal_amount,
    total_amount = totals.subtotal_amount + po.tax_amount + po.shipping_amount,
    updated_at = now()
from (
  select purchase_order_id, company_id, coalesce(sum(line_subtotal), 0)::numeric(14,2) as subtotal_amount
  from public.purchase_order_line_items
  group by purchase_order_id, company_id
) totals
where po.id = totals.purchase_order_id
  and po.company_id = totals.company_id;

commit;

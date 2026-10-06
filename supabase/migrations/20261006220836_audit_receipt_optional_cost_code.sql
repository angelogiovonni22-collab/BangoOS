begin;

create or replace function public.apply_procurement_receipt_ledger()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_line public.purchase_order_line_items%rowtype; v_ordered numeric; v_progress numeric;
begin
  update public.purchase_order_line_items set
    quantity_received=(new.line_quantities_after->>0)::numeric,
    quantity_damaged=(new.line_quantities_after->>1)::numeric,
    quantity_backordered=(new.line_quantities_after->>2)::numeric,updated_by=auth.uid(),updated_at=now()
    where company_id=new.company_id and purchase_order_id=new.purchase_order_id and id=new.purchase_order_line_item_id
    returning * into v_line;
  if not found then raise exception 'Unable to update purchase order line.' using errcode='42501'; end if;
  if new.inventory_quantity_received>0 then
    update public.materials set current_stock=current_stock+new.inventory_quantity_received,
      last_purchase_cost=v_line.unit_cost,last_purchase_date=new.received_date,updated_by=auth.uid()
      where company_id=new.company_id and id=v_line.material_id;
    if not found then raise exception 'Unable to update tracked inventory.' using errcode='42501'; end if;
  end if;
  select sum(quantity_ordered),sum(quantity_received+quantity_damaged) into v_ordered,v_progress
    from public.purchase_order_line_items where company_id=new.company_id and purchase_order_id=new.purchase_order_id;
  update public.purchase_orders set status=case when v_progress>=v_ordered then 'fully_received'
    when v_progress>0 then 'partially_received' else 'issued' end,updated_by=auth.uid()
    where company_id=new.company_id and id=new.purchase_order_id;
  if not found then raise exception 'Unable to update purchase order progress.' using errcode='42501'; end if;
  if v_line.cost_code_id is not null then
    perform public.recalculate_procurement_cost_code(new.company_id,v_line.cost_code_id);
  end if;
  return new;
end;
$$;

commit;

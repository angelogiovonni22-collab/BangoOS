begin;

create or replace function public.enforce_project_material_po_supplier()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_po_vendor_id uuid;
  v_plan_vendor_id uuid;
  v_plan_unit_cost numeric;
begin
  if new.project_material_plan_item_id is null then
    return new;
  end if;

  select vendor_id into v_po_vendor_id
  from public.purchase_orders
  where id = new.purchase_order_id and company_id = new.company_id;

  select selected_vendor_id, current_unit_cost
    into v_plan_vendor_id, v_plan_unit_cost
  from public.project_material_plan_items
  where id = new.project_material_plan_item_id
    and company_id = new.company_id
    and project_id = new.project_id;

  if v_plan_vendor_id is null then
    raise exception 'Select and verify a supplier for this project material before creating a purchase order.';
  end if;

  if v_po_vendor_id is distinct from v_plan_vendor_id then
    raise exception 'Purchase order supplier must match the selected supplier for the project material.';
  end if;

  if v_plan_unit_cost is null or abs(new.unit_cost - v_plan_unit_cost) > 0.0001 then
    raise exception 'Purchase order unit cost must match the current verified project material cost.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_material_po_supplier on public.purchase_order_line_items;
create trigger trg_enforce_project_material_po_supplier
before insert or update of purchase_order_id, project_material_plan_item_id, project_id, unit_cost
on public.purchase_order_line_items
for each row execute function public.enforce_project_material_po_supplier();

commit;

begin;

create or replace function public.guard_purchase_order_material_allocation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_status text;
  v_line public.purchase_order_line_items%rowtype;
  v_allocated numeric;
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id
       or new.purchase_order_id is distinct from old.purchase_order_id
       or new.purchase_order_line_item_id is distinct from old.purchase_order_line_item_id
       or new.material_id is distinct from old.material_id then
      raise exception 'Material allocations cannot be moved to another company, order, line, or material.' using errcode = '23514';
    end if;
    -- Notes and project/cost-code attribution may change without rewriting receipt history.
    if new.quantity_allocated is not distinct from old.quantity_allocated
       and new.unit_cost is not distinct from old.unit_cost
       and new.total_cost is not distinct from old.total_cost then
      return new;
    end if;
  end if;

  select po.status into v_status from public.purchase_orders po
  where po.id = new.purchase_order_id and po.company_id = new.company_id
  for update;
  if not found then
    raise exception 'Purchase order not found in this company.' using errcode = '23503';
  end if;
  if v_status not in ('issued', 'partially_received', 'fully_received') then
    raise exception 'Material allocations require an issued purchase order with received materials.' using errcode = '23514';
  end if;

  select li.* into v_line from public.purchase_order_line_items li
  where li.id = new.purchase_order_line_item_id
    and li.company_id = new.company_id and li.purchase_order_id = new.purchase_order_id
  for update;
  if not found then
    raise exception 'Purchase order line not found in this company and order.' using errcode = '23503';
  end if;
  if v_line.material_id is null or new.material_id is distinct from v_line.material_id then
    raise exception 'Allocated material must match the received purchase order line.' using errcode = '23514';
  end if;
  if new.quantity_allocated <= 0 or new.quantity_allocated::text in ('NaN', 'Infinity', '-Infinity')
     or new.unit_cost is distinct from v_line.unit_cost
     or new.total_cost is distinct from round(new.quantity_allocated * v_line.unit_cost, 2) then
    raise exception 'Allocation quantity and cost must match the received purchase order line.' using errcode = '23514';
  end if;

  select coalesce(sum(a.quantity_allocated), 0) into v_allocated
  from public.project_material_allocations a
  where a.company_id = new.company_id
    and a.purchase_order_line_item_id = new.purchase_order_line_item_id
    and a.id is distinct from new.id;
  if v_allocated + new.quantity_allocated > v_line.quantity_received then
    raise exception 'Allocated quantity cannot exceed received quantity.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_guard_purchase_order_material_allocation
before insert or update on public.project_material_allocations
for each row execute function public.guard_purchase_order_material_allocation();

create or replace function public.guard_allocated_purchase_order_receipts()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_allocated numeric;
begin
  select coalesce(sum(a.quantity_allocated), 0) into v_allocated
  from public.project_material_allocations a
  where a.company_id = old.company_id and a.purchase_order_line_item_id = old.id;
  if v_allocated > new.quantity_received then
    raise exception 'Received quantity cannot be reduced below allocated quantity.' using errcode = '23514';
  end if;
  if v_allocated > 0 and new.material_id is distinct from old.material_id then
    raise exception 'A received material with project allocations cannot be replaced.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_guard_allocated_purchase_order_receipts
before update of quantity_received, material_id on public.purchase_order_line_items
for each row execute function public.guard_allocated_purchase_order_receipts();

commit;

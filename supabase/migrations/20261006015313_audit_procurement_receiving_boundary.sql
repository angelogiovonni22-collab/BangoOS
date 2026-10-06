begin;

create or replace function public.guard_purchase_order_line_receiving()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_status text;
  v_material_status text;
  v_receiving_changed boolean;
begin
  if tg_op = 'UPDATE' and (new.company_id is distinct from old.company_id or new.purchase_order_id is distinct from old.purchase_order_id) then
    raise exception 'Purchase order lines cannot be moved to another company or order.' using errcode = '23514';
  end if;

  select po.status into v_status from public.purchase_orders po
  where po.id = new.purchase_order_id and po.company_id = new.company_id
  for update;
  if not found then
    raise exception 'Purchase order not found in this company.' using errcode = '23503';
  end if;

  if new.quantity_received < 0 or new.quantity_damaged < 0 or new.quantity_backordered < 0
     or new.quantity_received + new.quantity_damaged > new.quantity_ordered then
    raise exception 'Receipt quantities must be non-negative and cannot exceed the order.' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    v_receiving_changed := new.quantity_received > 0 or new.quantity_damaged > 0 or new.quantity_backordered > 0;
  else
    v_receiving_changed := new.quantity_received is distinct from old.quantity_received
      or new.quantity_damaged is distinct from old.quantity_damaged
      or new.quantity_backordered is distinct from old.quantity_backordered;
  end if;
  if v_receiving_changed and v_status not in ('issued', 'partially_received') then
    raise exception 'Receipts require an issued purchase order with outstanding quantities.' using errcode = '23514';
  end if;

  if new.material_id is not null and (tg_op = 'INSERT' or new.material_id is distinct from old.material_id) then
    select m.status into v_material_status from public.materials m
    where m.id = new.material_id and m.company_id = new.company_id;
    if not found or v_material_status <> 'active' then
      raise exception 'Only active materials in this company can be added to a new purchase order.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_purchase_order_line_receiving
before insert or update of company_id, purchase_order_id, material_id, quantity_ordered, quantity_received, quantity_damaged, quantity_backordered
on public.purchase_order_line_items
for each row execute function public.guard_purchase_order_line_receiving();

create or replace function public.guard_purchase_order_receipt_state()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare v_status text;
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id or new.purchase_order_id is distinct from old.purchase_order_id then
      raise exception 'Receipt history cannot be moved to another company or order.' using errcode = '23514';
    end if;
    return new;
  end if;
  select po.status into v_status from public.purchase_orders po
  where po.id = new.purchase_order_id and po.company_id = new.company_id
  for update;
  if not found then
    raise exception 'Purchase order not found in this company.' using errcode = '23503';
  end if;
  if v_status not in ('issued', 'partially_received') then
    raise exception 'Receipts require an issued purchase order with outstanding quantities.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_guard_purchase_order_receipt_state
before insert or update of company_id, purchase_order_id
on public.purchase_order_receipts
for each row execute function public.guard_purchase_order_receipt_state();

comment on function public.guard_purchase_order_line_receiving() is 'Enforces company, active catalog, quantity, and issued-order receiving boundaries without bypassing RLS.';
comment on function public.guard_purchase_order_receipt_state() is 'Protects receipt history and prevents new receipts on unissued or closed purchase orders.';

commit;

begin;

-- Existing allocations do not record whether inventory was tracked at allocation
-- time. Keep that unknown instead of inventing a stock balance during backfill.
alter table public.project_material_allocations
  add column inventory_quantity_consumed numeric(14,3),
  add constraint project_material_allocations_inventory_quantity_check
    check (inventory_quantity_consumed is null or
      (inventory_quantity_consumed >= 0 and inventory_quantity_consumed <= quantity_allocated
       and inventory_quantity_consumed::text not in ('NaN','Infinity','-Infinity')));
comment on column public.project_material_allocations.inventory_quantity_consumed is
  'Inventory actually deducted for this allocation. NULL means legacy tracking history is unknown; reconcile before quantity correction or deletion.';

create function public.reconcile_material_allocation_inventory()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare
  v_company uuid;
  v_material uuid;
  v_stock public.materials%rowtype;
  v_previous numeric := 0;
  v_next numeric := 0;
begin
  if tg_op='DELETE' then v_company:=old.company_id; v_material:=old.material_id;
  else v_company:=new.company_id; v_material:=new.material_id; end if;
  -- Company removal is an explicit separate retention workflow, not a stock return.
  if tg_op='DELETE' and not exists(select 1 from public.companies where id=v_company) then return old; end if;
  if tg_op='UPDATE' then
    if new.quantity_allocated is not distinct from old.quantity_allocated then
      new.inventory_quantity_consumed:=old.inventory_quantity_consumed;
      return new;
    end if;
  end if;
  if tg_op in ('UPDATE','DELETE') then
    if old.inventory_quantity_consumed is null then
      raise exception 'Legacy allocation inventory must be reconciled before changing quantity or deleting it.' using errcode='23514';
    end if;
    v_previous:=old.inventory_quantity_consumed;
  end if;
  select * into v_stock from public.materials
  where company_id=v_company and id=v_material for update;
  if not found then raise exception 'Allocated material not found in this company.' using errcode='23503'; end if;
  if tg_op='INSERT' then
    if v_stock.track_inventory then v_next:=new.quantity_allocated; end if;
  elsif tg_op='UPDATE' and v_previous>0 then v_next:=new.quantity_allocated;
  end if;
  if v_next>v_previous and v_stock.current_stock<v_next-v_previous then
    raise exception 'Insufficient inventory for allocation.' using errcode='23514';
  end if;
  if v_previous<>v_next then
    update public.materials set current_stock=current_stock+v_previous-v_next,updated_by=auth.uid()
    where company_id=v_company and id=v_material;
    if not found then raise exception 'Unable to update tracked inventory.' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  new.inventory_quantity_consumed:=v_next;
  return new;
end;
$$;

-- Runs after the existing receipt/material/cost guard and before the row is stored.
create trigger trg_z_reconcile_material_allocation_inventory
before insert or update or delete on public.project_material_allocations
for each row execute function public.reconcile_material_allocation_inventory();

create function public.reconcile_material_allocation_costs()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_company uuid; v_old_code uuid; v_new_code uuid; v_code uuid;
begin
  if tg_op='UPDATE' and new.cost_code_id is not distinct from old.cost_code_id
    and new.total_cost is not distinct from old.total_cost then return new; end if;
  if tg_op<>'INSERT' then v_company:=old.company_id; v_old_code:=old.cost_code_id; end if;
  if tg_op<>'DELETE' then v_company:=new.company_id; v_new_code:=new.cost_code_id; end if;
  if tg_op='DELETE' and not exists(select 1 from public.companies where id=v_company) then return old; end if;
  for v_code in select distinct code from unnest(array[v_old_code,v_new_code]) as codes(code)
    where code is not null order by code loop
    perform public.recalculate_procurement_cost_code(v_company,v_code);
  end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger trg_reconcile_material_allocation_costs
after insert or update or delete on public.project_material_allocations
for each row execute function public.reconcile_material_allocation_costs();

revoke all on function public.reconcile_material_allocation_inventory() from public,anon,authenticated;
revoke all on function public.reconcile_material_allocation_costs() from public,anon,authenticated;

create or replace function public.apply_procurement_fulfillment(
  p_company_id uuid, p_operation_id uuid, p_kind text, p_payload jsonb
) returns uuid
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_operation public.procurement_fulfillment_operations%rowtype;
  v_order public.purchase_orders%rowtype;
  v_line public.purchase_order_line_items%rowtype;
  v_material public.materials%rowtype;
  v_result uuid;
  v_received numeric(14,3);
  v_damaged numeric(14,3);
  v_backordered numeric(14,3);
  v_quantity numeric(14,3);
  v_date date;
  v_cost_code uuid;
  v_progress numeric;
  v_ordered numeric;
begin
  if v_user is null or p_operation_id is null or p_kind is null or p_kind not in ('receive','allocate')
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not public.has_company_role(p_company_id,
       array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','accountant']) then
    raise exception 'Not authorized for this purchasing operation.' using errcode='42501';
  end if;
  insert into public.procurement_fulfillment_operations(company_id,operation_id,created_by,operation_kind,payload)
  values(p_company_id,p_operation_id,v_user,p_kind,p_payload)
  on conflict(company_id,operation_id) do nothing;
  select * into v_operation from public.procurement_fulfillment_operations
  where company_id=p_company_id and operation_id=p_operation_id for update;
  if not found or v_operation.created_by <> v_user then
    raise exception 'Purchasing operation belongs to another user.' using errcode='42501';
  end if;
  if v_operation.operation_kind is distinct from p_kind or v_operation.payload is distinct from p_payload then
    raise exception 'Retry must use the original purchasing operation details.' using errcode='23514';
  end if;
  if v_operation.result_id is not null then return v_operation.result_id; end if;

  -- All callers lock the parent before its line and stock row.
  select * into v_order from public.purchase_orders
  where company_id=p_company_id and id=(p_payload->>'purchaseOrderId')::uuid for update;
  if not found then raise exception 'Purchase order not found in this company.' using errcode='23503'; end if;
  select * into v_line from public.purchase_order_line_items
  where company_id=p_company_id and purchase_order_id=v_order.id
    and id=(p_payload->>'lineItemId')::uuid for update;
  if not found then raise exception 'Purchase order line not found in this company and order.' using errcode='23503'; end if;
  if v_line.material_id is not null then
    select * into v_material from public.materials
    where company_id=p_company_id and id=v_line.material_id for update;
    if not found then raise exception 'Material not found in this company.' using errcode='23503'; end if;
  end if;

  if p_kind='receive' then
    if v_order.status not in ('issued','partially_received') then
      raise exception 'Receipts require an issued purchase order with outstanding quantities.' using errcode='23514';
    end if;
    v_received := (p_payload->>'quantityReceived')::numeric;
    v_damaged := (p_payload->>'quantityDamaged')::numeric;
    v_backordered := (p_payload->>'quantityBackordered')::numeric;
    v_date := (p_payload->>'receivedDate')::date;
    if v_received is null or v_damaged is null or v_backordered is null or v_date is null
       or v_received::text in ('NaN','Infinity','-Infinity')
       or v_damaged::text in ('NaN','Infinity','-Infinity')
       or v_backordered::text in ('NaN','Infinity','-Infinity')
       or least(v_received,v_damaged,v_backordered)<0
       or v_received+v_damaged+v_backordered<=0
       or v_line.quantity_received+v_line.quantity_damaged+v_received+v_damaged>v_line.quantity_ordered then
      raise exception 'Receipt quantities must be positive, finite, and within the order.' using errcode='23514';
    end if;
    update public.purchase_order_line_items set
      quantity_received=quantity_received+v_received,
      quantity_damaged=quantity_damaged+v_damaged,
      quantity_backordered=quantity_backordered+v_backordered,
      updated_by=v_user, updated_at=now()
    where company_id=p_company_id and id=v_line.id;
    if not found then raise exception 'Unable to update purchase order line.' using errcode='42501'; end if;
    insert into public.purchase_order_receipts(company_id,purchase_order_id,received_date,notes,received_by,created_by,updated_by)
    values(p_company_id,v_order.id,v_date,p_payload->>'notes',v_user,v_user,v_user) returning id into v_result;
    if v_material.track_inventory and v_received>0 then
      update public.materials set current_stock=current_stock+v_received,
        last_purchase_cost=v_line.unit_cost,last_purchase_date=v_date,updated_by=v_user
      where company_id=p_company_id and id=v_material.id;
      if not found then raise exception 'Unable to update tracked inventory.' using errcode='42501'; end if;
    end if;
    select sum(quantity_ordered),sum(quantity_received+quantity_damaged)
      into v_ordered,v_progress from public.purchase_order_line_items
      where company_id=p_company_id and purchase_order_id=v_order.id;
    update public.purchase_orders set status=case when v_progress>=v_ordered then 'fully_received'
      when v_progress>0 then 'partially_received' else 'issued' end,updated_by=v_user
      where company_id=p_company_id and id=v_order.id;
    if not found then raise exception 'Unable to update purchase order progress.' using errcode='42501'; end if;
    v_cost_code := v_line.cost_code_id;
  else
    v_quantity := (p_payload->>'quantityAllocated')::numeric;
    if v_quantity is null or v_quantity<=0 or v_quantity::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Allocated quantity must be positive and finite.' using errcode='23514';
    end if;
    if v_line.material_id is null or v_line.material_id is distinct from (p_payload->>'materialId')::uuid
       or (p_payload->>'unitCost')::numeric is distinct from v_line.unit_cost then
      raise exception 'Allocated material and cost must match the received line.' using errcode='23514';
    end if;
    if v_material.track_inventory and v_material.current_stock<v_quantity then
      raise exception 'Insufficient inventory for allocation.' using errcode='23514';
    end if;
    v_cost_code := (p_payload->>'costCodeId')::uuid;
    insert into public.project_material_allocations(company_id,purchase_order_id,purchase_order_line_item_id,
      material_id,project_id,cost_code_id,quantity_allocated,unit_cost,total_cost,notes,allocated_by,created_by,updated_by)
    values(p_company_id,v_order.id,v_line.id,v_line.material_id,(p_payload->>'projectId')::uuid,
      v_cost_code,v_quantity,v_line.unit_cost,round(v_quantity*v_line.unit_cost,2),p_payload->>'notes',v_user,v_user,v_user)
    returning id into v_result;
    -- Allocation triggers reconcile inventory and both cost-code attributions atomically.
  end if;

  if p_kind='receive' and v_cost_code is not null then
    perform public.recalculate_procurement_cost_code(p_company_id,v_cost_code);
  end if;
  update public.procurement_fulfillment_operations set result_id=v_result
  where company_id=p_company_id and operation_id=p_operation_id;
  return v_result;
end;
$$;
commit;

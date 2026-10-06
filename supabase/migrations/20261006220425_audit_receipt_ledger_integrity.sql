begin;

-- Historical headers lack per-line quantities; preserve that uncertainty.
alter table public.purchase_order_receipts
  add column purchase_order_line_item_id uuid references public.purchase_order_line_items(id) on delete restrict,
  add column quantity_received numeric(14,3),
  add column quantity_damaged numeric(14,3),
  add column quantity_backordered numeric(14,3),
  add column inventory_quantity_received numeric(14,3),
  add column line_quantities_before jsonb,
  add column line_quantities_after jsonb;
create index purchase_order_receipts_line_idx on public.purchase_order_receipts(company_id,purchase_order_line_item_id);

create function public.prepare_procurement_receipt_ledger()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_line public.purchase_order_line_items%rowtype; v_status text; v_tracked boolean; v_user uuid:=auth.uid();
begin
  if tg_op='DELETE' then
    raise exception 'Receipt history cannot be deleted; retain it for reconciliation.' using errcode='23514';
  end if;
  if tg_op='UPDATE' then
    if (new.company_id,new.purchase_order_id,new.purchase_order_line_item_id,new.received_date,
        new.quantity_received,new.quantity_damaged,new.quantity_backordered,new.inventory_quantity_received,
        new.line_quantities_before,new.line_quantities_after,new.received_by,new.created_by)
      is distinct from
       (old.company_id,old.purchase_order_id,old.purchase_order_line_item_id,old.received_date,
        old.quantity_received,old.quantity_damaged,old.quantity_backordered,old.inventory_quantity_received,
        old.line_quantities_before,old.line_quantities_after,old.received_by,old.created_by) then
      raise exception 'Receipt quantities, inventory effects and actor history are immutable.' using errcode='23514';
    end if;
    new.updated_by:=v_user;
    return new;
  end if;
  if v_user is null or not public.has_company_role(new.company_id,
    array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','accountant']) then
    raise exception 'Not authorized for this purchasing operation.' using errcode='42501';
  end if;
  select status into v_status from public.purchase_orders where company_id=new.company_id and id=new.purchase_order_id for update;
  if not found or v_status not in ('issued','partially_received') then
    raise exception 'Receipts require an issued purchase order with outstanding quantities.' using errcode='23514';
  end if;
  select * into v_line from public.purchase_order_line_items
    where company_id=new.company_id and purchase_order_id=new.purchase_order_id and id=new.purchase_order_line_item_id for update;
  if not found then raise exception 'Receipt must identify a line in this company and order.' using errcode='23503'; end if;
  if new.received_date is null or new.quantity_received is null or new.quantity_damaged is null or new.quantity_backordered is null
    or new.quantity_received::text in ('NaN','Infinity','-Infinity')
    or new.quantity_damaged::text in ('NaN','Infinity','-Infinity')
    or new.quantity_backordered::text in ('NaN','Infinity','-Infinity')
    or least(new.quantity_received,new.quantity_damaged,new.quantity_backordered)<0
    or new.quantity_received+new.quantity_damaged+new.quantity_backordered<=0
    or v_line.quantity_received+v_line.quantity_damaged+new.quantity_received+new.quantity_damaged>v_line.quantity_ordered then
    raise exception 'Receipt quantities must be positive, finite, and within the order.' using errcode='23514';
  end if;
  if v_line.material_id is not null then
    select track_inventory into v_tracked from public.materials where company_id=new.company_id and id=v_line.material_id for update;
    if not found then raise exception 'Material not found in this company.' using errcode='23503'; end if;
  end if;
  new.inventory_quantity_received:=case when v_tracked then new.quantity_received else 0 end;
  new.line_quantities_before:=jsonb_build_array(v_line.quantity_received,v_line.quantity_damaged,v_line.quantity_backordered);
  new.line_quantities_after:=jsonb_build_array(v_line.quantity_received+new.quantity_received,
    v_line.quantity_damaged+new.quantity_damaged,v_line.quantity_backordered+new.quantity_backordered);
  new.received_by:=v_user; new.created_by:=v_user; new.updated_by:=v_user;
  return new;
end;
$$;
create trigger trg_prepare_procurement_receipt_ledger before insert or update or delete on public.purchase_order_receipts
for each row execute function public.prepare_procurement_receipt_ledger();

create function public.guard_procurement_line_receipt_ledger()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_status text;
begin
  if tg_op='DELETE' then
    select status into v_status from public.purchase_orders where company_id=old.company_id and id=old.purchase_order_id for update;
    if (v_status is not null and v_status<>'draft') or old.quantity_received<>0 or old.quantity_damaged<>0 or old.quantity_backordered<>0
      or exists(select 1 from public.purchase_order_receipts where company_id=old.company_id and purchase_order_line_item_id=old.id)
      or exists(select 1 from public.project_material_allocations where company_id=old.company_id and purchase_order_line_item_id=old.id) then
      raise exception 'Only unused draft lines can be deleted; retain purchasing history.' using errcode='23514';
    end if;
    return old;
  end if;
  if tg_op='INSERT' then
    if new.quantity_received<>0 or new.quantity_damaged<>0 or new.quantity_backordered<>0 then
      raise exception 'Record receipt quantities through the receipt workflow.' using errcode='23514';
    end if;
    return new;
  end if;
  if (new.quantity_received,new.quantity_damaged,new.quantity_backordered)
    is not distinct from (old.quantity_received,old.quantity_damaged,old.quantity_backordered) then return new; end if;
  if not exists(select 1 from public.purchase_order_receipts r
    where r.company_id=new.company_id and r.purchase_order_id=new.purchase_order_id and r.purchase_order_line_item_id=new.id
      and r.line_quantities_before=jsonb_build_array(old.quantity_received,old.quantity_damaged,old.quantity_backordered)
      and r.line_quantities_after=jsonb_build_array(new.quantity_received,new.quantity_damaged,new.quantity_backordered)) then
    raise exception 'Record receipt quantities through the receipt workflow.' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger trg_guard_procurement_line_receipt_ledger before insert or update or delete on public.purchase_order_line_items
for each row execute function public.guard_procurement_line_receipt_ledger();

create function public.apply_procurement_receipt_ledger()
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
  perform public.recalculate_procurement_cost_code(new.company_id,v_line.cost_code_id);
  return new;
end;
$$;
create trigger trg_apply_procurement_receipt_ledger after insert on public.purchase_order_receipts
for each row execute function public.apply_procurement_receipt_ledger();

create function public.guard_procurement_order_deletion()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
begin
  if old.status<>'draft' or exists(select 1 from public.purchase_order_receipts where company_id=old.company_id and purchase_order_id=old.id)
    or exists(select 1 from public.project_material_allocations where company_id=old.company_id and purchase_order_id=old.id) then
    raise exception 'Only unused draft orders can be deleted; retain purchasing history.' using errcode='23514';
  end if;
  return old;
end;
$$;
create trigger trg_guard_procurement_order_deletion before delete on public.purchase_orders
for each row execute function public.guard_procurement_order_deletion();

revoke all on function public.prepare_procurement_receipt_ledger() from public,anon,authenticated;
revoke all on function public.guard_procurement_line_receipt_ledger() from public,anon,authenticated;
revoke all on function public.apply_procurement_receipt_ledger() from public,anon,authenticated;
revoke all on function public.guard_procurement_order_deletion() from public,anon,authenticated;
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
    -- The receipt ledger atomically applies quantities, stock, progress and costs.
    insert into public.purchase_order_receipts(company_id,purchase_order_id,purchase_order_line_item_id,
      received_date,quantity_received,quantity_damaged,quantity_backordered,notes,received_by,created_by,updated_by)
    values(p_company_id,v_order.id,v_line.id,v_date,v_received,v_damaged,v_backordered,
      p_payload->>'notes',v_user,v_user,v_user) returning id into v_result;
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

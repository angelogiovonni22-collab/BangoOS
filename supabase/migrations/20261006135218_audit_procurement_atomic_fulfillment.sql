begin;

-- A completed operation and its business writes commit together. A lost response
-- can therefore be retried without receiving or consuming inventory twice.
create table public.procurement_fulfillment_operations (
  company_id uuid not null references public.companies(id) on delete cascade,
  operation_id uuid not null,
  created_by uuid not null references public.profiles(id),
  operation_kind text not null check(operation_kind in ('receive', 'allocate')),
  payload jsonb not null,
  result_id uuid,
  created_at timestamptz not null default now(),
  primary key(company_id, operation_id)
);
alter table public.procurement_fulfillment_operations enable row level security;
create policy procurement_fulfillment_operations_access
on public.procurement_fulfillment_operations for all to authenticated
using (created_by = auth.uid() and public.has_company_role(company_id,
  array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','accountant']))
with check (created_by = auth.uid() and public.has_company_role(company_id,
  array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','accountant']));
revoke all on public.procurement_fulfillment_operations from public, anon;
grant select, insert, update on public.procurement_fulfillment_operations to authenticated;

create function public.apply_procurement_fulfillment(
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
  v_committed numeric;
  v_actual numeric;
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
    if v_material.track_inventory then
      update public.materials set current_stock=current_stock-v_quantity,updated_by=v_user
      where company_id=p_company_id and id=v_material.id;
      if not found then raise exception 'Unable to update tracked inventory.' using errcode='42501'; end if;
    end if;
  end if;

  if v_cost_code is not null then
    -- Serialize recalculation for operations sharing the same cost code.
    perform 1 from public.cost_codes where company_id=p_company_id and id=v_cost_code for update;
    if not found then raise exception 'Cost code not found or not writable.' using errcode='42501'; end if;
    select coalesce(sum(greatest(0,li.quantity_ordered-li.quantity_received-li.quantity_damaged)*li.unit_cost),0)
    into v_committed from public.purchase_order_line_items li
    join public.purchase_orders po on po.id=li.purchase_order_id and po.company_id=li.company_id
    where li.company_id=p_company_id and li.cost_code_id=v_cost_code
      and po.status not in ('cancelled','fully_received');
    select coalesce(sum(total_cost),0) into v_actual from public.project_material_allocations
    where company_id=p_company_id and cost_code_id=v_cost_code;
    update public.cost_codes set committed_cost=round(v_committed,2),actual_cost=round(v_actual,2)
    where company_id=p_company_id and id=v_cost_code;
    if not found then raise exception 'Unable to update purchasing cost totals.' using errcode='42501'; end if;
  end if;
  update public.procurement_fulfillment_operations set result_id=v_result
  where company_id=p_company_id and operation_id=p_operation_id;
  return v_result;
end;
$$;
revoke all on function public.apply_procurement_fulfillment(uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.apply_procurement_fulfillment(uuid,uuid,text,jsonb) to authenticated;
comment on function public.apply_procurement_fulfillment(uuid,uuid,text,jsonb) is
  'Atomic, retry-safe receipts and allocations; existing table RLS remains enforced.';
commit;

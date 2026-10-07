begin;

create table public.purchase_order_receipt_reversals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  receipt_id uuid not null references public.purchase_order_receipts(id) on delete restrict,
  operation_id uuid not null,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  purchase_order_line_item_id uuid not null references public.purchase_order_line_items(id) on delete restrict,
  reason text not null check(length(btrim(reason)) between 1 and 1000),
  quantity_received numeric(14,3) not null,
  quantity_damaged numeric(14,3) not null,
  quantity_backordered numeric(14,3) not null,
  inventory_quantity_removed numeric(14,3) not null,
  line_quantities_before jsonb not null,
  line_quantities_after jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(company_id,receipt_id),
  unique(company_id,operation_id)
);
alter table public.purchase_order_receipt_reversals enable row level security;
revoke all on public.purchase_order_receipt_reversals from public,anon,authenticated;
grant select,insert on public.purchase_order_receipt_reversals to authenticated;
create policy receipt_reversals_read on public.purchase_order_receipt_reversals
for select to authenticated using(public.bos_role_has_permission(company_id,'materials.view'));
create policy receipt_reversals_insert on public.purchase_order_receipt_reversals
for insert to authenticated with check(public.bos_role_has_permission(company_id,'materials.manage') and created_by=auth.uid());

create function public.prepare_procurement_receipt_reversal()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_receipt public.purchase_order_receipts%rowtype; v_line public.purchase_order_line_items%rowtype;
  v_status text; v_stock numeric; v_allocated numeric;
begin
  if tg_op<>'INSERT' then raise exception 'Receipt reversal history is immutable.' using errcode='23514'; end if;
  if auth.uid() is null or not public.bos_role_has_permission(new.company_id,'materials.manage') then
    raise exception 'Not authorized to reverse receipts.' using errcode='42501'; end if;
  new.reason:=btrim(new.reason);
  if new.operation_id is null or new.reason is null or length(new.reason) not between 1 and 1000 then
    raise exception 'A receipt reversal requires a reason and retry identifier.' using errcode='23514'; end if;
  select * into v_receipt from public.purchase_order_receipts where company_id=new.company_id and id=new.receipt_id;
  if not found then raise exception 'Receipt not found in this company.' using errcode='23503'; end if;
  select status into v_status from public.purchase_orders
    where company_id=new.company_id and id=v_receipt.purchase_order_id for update;
  if not found or v_status not in ('issued','partially_received','fully_received') then
    raise exception 'Only receipts on issued orders can be reversed.' using errcode='23514'; end if;
  -- Parent first, then line/stock: the same lock order as receipt/allocation.
  select * into v_line from public.purchase_order_line_items
    where company_id=new.company_id and purchase_order_id=v_receipt.purchase_order_id
      and id=v_receipt.purchase_order_line_item_id for update;
  if not found or v_receipt.quantity_received is null or v_receipt.quantity_damaged is null
    or v_receipt.quantity_backordered is null or v_receipt.inventory_quantity_received is null then
    raise exception 'Legacy receipt effects are unknown; reconcile this history before correction.' using errcode='23514'; end if;
  if exists(select 1 from public.purchase_order_receipt_reversals where company_id=new.company_id and receipt_id=new.receipt_id) then
    raise exception 'This receipt has already been reversed.' using errcode='23514'; end if;
  if least(v_line.quantity_received-v_receipt.quantity_received,v_line.quantity_damaged-v_receipt.quantity_damaged,
      v_line.quantity_backordered-v_receipt.quantity_backordered)<0 then
    raise exception 'Receipt history does not reconcile with the current line quantities.' using errcode='23514'; end if;
  select coalesce(sum(quantity_allocated),0) into v_allocated from public.project_material_allocations
    where company_id=new.company_id and purchase_order_line_item_id=v_line.id;
  if v_allocated>v_line.quantity_received-v_receipt.quantity_received then
    raise exception 'Correct the project allocations before reversing this receipt.' using errcode='23514'; end if;
  if v_receipt.inventory_quantity_received>0 then
    select current_stock into v_stock from public.materials where company_id=new.company_id and id=v_line.material_id for update;
    if not found or v_stock<v_receipt.inventory_quantity_received then
      raise exception 'Insufficient inventory to reverse this receipt.' using errcode='23514'; end if;
  end if;
  new.purchase_order_id:=v_receipt.purchase_order_id; new.purchase_order_line_item_id:=v_line.id;
  new.quantity_received:=v_receipt.quantity_received; new.quantity_damaged:=v_receipt.quantity_damaged;
  new.quantity_backordered:=v_receipt.quantity_backordered; new.inventory_quantity_removed:=v_receipt.inventory_quantity_received;
  new.line_quantities_before:=jsonb_build_array(v_line.quantity_received,v_line.quantity_damaged,v_line.quantity_backordered);
  new.line_quantities_after:=jsonb_build_array(v_line.quantity_received-v_receipt.quantity_received,
    v_line.quantity_damaged-v_receipt.quantity_damaged,v_line.quantity_backordered-v_receipt.quantity_backordered);
  new.created_by:=auth.uid(); new.created_at:=now();
  return new;
end;
$$;
create trigger trg_prepare_procurement_receipt_reversal before insert or update or delete
on public.purchase_order_receipt_reversals for each row execute function public.prepare_procurement_receipt_reversal();

create function public.apply_procurement_receipt_reversal()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_line public.purchase_order_line_items%rowtype; v_ordered numeric; v_progress numeric;
begin
  update public.purchase_order_line_items set quantity_received=(new.line_quantities_after->>0)::numeric,
    quantity_damaged=(new.line_quantities_after->>1)::numeric,quantity_backordered=(new.line_quantities_after->>2)::numeric,
    updated_by=auth.uid(),updated_at=now()
    where company_id=new.company_id and id=new.purchase_order_line_item_id returning * into v_line;
  if not found then raise exception 'Unable to correct receipt quantities.' using errcode='42501'; end if;
  if new.inventory_quantity_removed>0 then
    update public.materials set current_stock=current_stock-new.inventory_quantity_removed,updated_by=auth.uid()
      where company_id=new.company_id and id=v_line.material_id;
    if not found then raise exception 'Unable to reconcile receipt inventory.' using errcode='42501'; end if;
  end if;
  select sum(quantity_ordered),sum(quantity_received+quantity_damaged) into v_ordered,v_progress
    from public.purchase_order_line_items where company_id=new.company_id and purchase_order_id=new.purchase_order_id;
  update public.purchase_orders set status=case when v_progress>=v_ordered then 'fully_received'
    when v_progress>0 then 'partially_received' else 'issued' end,updated_by=auth.uid()
    where company_id=new.company_id and id=new.purchase_order_id;
  if not found then raise exception 'Unable to reconcile order progress.' using errcode='42501'; end if;
  if v_line.cost_code_id is not null then perform public.recalculate_procurement_cost_code(new.company_id,v_line.cost_code_id); end if;
  return new;
end;
$$;
create trigger trg_apply_procurement_receipt_reversal after insert on public.purchase_order_receipt_reversals
for each row execute function public.apply_procurement_receipt_reversal();

create function public.reverse_procurement_receipt(p_company_id uuid,p_operation_id uuid,p_receipt_id uuid,p_reason text)
returns uuid language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_prior public.purchase_order_receipt_reversals%rowtype; v_order uuid; v_id uuid;
begin
  if auth.uid() is null or not public.bos_role_has_permission(p_company_id,'materials.manage') then
    raise exception 'Not authorized to reverse receipts.' using errcode='42501'; end if;
  if p_operation_id is null or p_receipt_id is null or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'Select a receipt and enter a reversal reason.' using errcode='23514'; end if;
  -- Serialize identical retry keys even when a changed payload targets another order.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text||':'||p_operation_id::text,0));
  select * into v_prior from public.purchase_order_receipt_reversals where company_id=p_company_id and operation_id=p_operation_id;
  if found then
    if v_prior.receipt_id is distinct from p_receipt_id or v_prior.reason is distinct from btrim(p_reason) or v_prior.created_by<>auth.uid() then
      raise exception 'Retry must use the original receipt reversal details and user.' using errcode='23514'; end if;
    return v_prior.id;
  end if;
  select purchase_order_id into v_order from public.purchase_order_receipts where company_id=p_company_id and id=p_receipt_id;
  if not found then raise exception 'Receipt not found in this company.' using errcode='23503'; end if;
  insert into public.purchase_order_receipt_reversals(company_id,receipt_id,operation_id,purchase_order_id,purchase_order_line_item_id,
    reason,quantity_received,quantity_damaged,quantity_backordered,inventory_quantity_removed,line_quantities_before,line_quantities_after,created_by)
  values(p_company_id,p_receipt_id,p_operation_id,v_order,p_receipt_id,btrim(p_reason),0,0,0,0,'[]','[]',auth.uid()) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.prepare_procurement_receipt_reversal() from public,anon,authenticated;
revoke all on function public.apply_procurement_receipt_reversal() from public,anon,authenticated;
revoke all on function public.reverse_procurement_receipt(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.reverse_procurement_receipt(uuid,uuid,uuid,text) to authenticated;

-- Replaced counter/lifecycle guards follow below.
create or replace function public.guard_procurement_line_receipt_ledger()
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
  if pg_trigger_depth()<2 then raise exception 'Record receipt quantities through the receipt workflow.' using errcode='23514'; end if;
  if not exists(select 1 from public.purchase_order_receipts r
    where r.company_id=new.company_id and r.purchase_order_id=new.purchase_order_id and r.purchase_order_line_item_id=new.id
      and r.line_quantities_before=jsonb_build_array(old.quantity_received,old.quantity_damaged,old.quantity_backordered)
      and r.line_quantities_after=jsonb_build_array(new.quantity_received,new.quantity_damaged,new.quantity_backordered))
    and not exists(select 1 from public.purchase_order_receipt_reversals r where r.company_id=new.company_id
      and r.purchase_order_id=new.purchase_order_id and r.purchase_order_line_item_id=new.id
      and r.line_quantities_before=jsonb_build_array(old.quantity_received,old.quantity_damaged,old.quantity_backordered)
      and r.line_quantities_after=jsonb_build_array(new.quantity_received,new.quantity_damaged,new.quantity_backordered)) then
    raise exception 'Record receipt quantities through the receipt workflow.' using errcode='23514';
  end if;
  return new;
end;
$$;

create or replace function public.guard_procurement_order_lifecycle()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_progress numeric; v_ordered numeric; v_user uuid:=auth.uid();
begin
  if tg_op='INSERT' then
    if new.status<>'draft' then raise exception 'New purchase orders must start as drafts.' using errcode='23514'; end if;
    if not exists(select 1 from public.vendors where company_id=new.company_id and id=new.vendor_id and status='active') then
      raise exception 'Select an active vendor in this company.' using errcode='23514'; end if;
    new.approved_at:=null; new.approved_by:=null; new.issued_at:=null; new.issued_by:=null;
    new.cancelled_at:=null; new.cancelled_by:=null;
    return new;
  end if;
  if new.company_id is distinct from old.company_id then
    raise exception 'Purchase orders cannot be moved to another company.' using errcode='23514'; end if;
  -- Supplier changes must not bypass the verified material-plan line supplier.
  if new.vendor_id is distinct from old.vendor_id and exists(
    select 1 from public.purchase_order_line_items li join public.project_material_plan_items plan
      on plan.id=li.project_material_plan_item_id and plan.company_id=li.company_id
    where li.company_id=new.company_id and li.purchase_order_id=new.id and plan.selected_vendor_id is distinct from new.vendor_id
  ) then raise exception 'Purchase order supplier must match its project material requirements.' using errcode='23514'; end if;
  if old.status<>'draft' and (new.vendor_id is distinct from old.vendor_id
    or new.project_id is distinct from old.project_id) then
    raise exception 'Approved purchase order supplier and project cannot be changed.' using errcode='23514'; end if;
  new.approved_at:=old.approved_at; new.approved_by:=old.approved_by;
  new.issued_at:=old.issued_at; new.issued_by:=old.issued_by;
  new.cancelled_at:=old.cancelled_at; new.cancelled_by:=old.cancelled_by;
  if new.status is not distinct from old.status then return new; end if;
  if old.status in ('fully_received','partially_received') and new.status in ('issued','partially_received') and pg_trigger_depth()>1
    and exists(select 1 from public.purchase_order_receipt_reversals r where r.company_id=new.company_id
      and r.purchase_order_id=new.id and r.xmin::text=pg_current_xact_id()::text) then
    select sum(quantity_ordered),sum(quantity_received+quantity_damaged) into v_ordered,v_progress
      from public.purchase_order_line_items where company_id=new.company_id and purchase_order_id=new.id;
    if v_progress>=v_ordered or (new.status='issued' and v_progress<>0)
      or (new.status='partially_received' and v_progress<=0) then
      raise exception 'Order correction state must match its receipt history.' using errcode='23514'; end if;
    return new;
  end if;
  if not (
    (old.status='draft' and new.status in ('approved','cancelled')) or
    (old.status='approved' and new.status in ('issued','cancelled')) or
    (old.status in ('issued','partially_received') and new.status in ('partially_received','fully_received','cancelled'))
  ) then raise exception 'Invalid purchase order state transition.' using errcode='23514'; end if;
  if new.status='approved' then
    if not exists(select 1 from public.purchase_order_line_items where company_id=new.company_id and purchase_order_id=new.id) then
      raise exception 'A purchase order needs at least one line before approval.' using errcode='23514'; end if;
    new.approved_at:=now(); new.approved_by:=v_user;
  elsif new.status='issued' then new.issued_at:=now(); new.issued_by:=v_user;
  elsif new.status='cancelled' then new.cancelled_at:=now(); new.cancelled_by:=v_user;
  else
    select sum(quantity_ordered),sum(quantity_received+quantity_damaged) into v_ordered,v_progress
    from public.purchase_order_line_items where company_id=new.company_id and purchase_order_id=new.id;
    if v_ordered is null or v_progress<=0 or
      (new.status='fully_received' and v_progress<v_ordered) or
      (new.status='partially_received' and v_progress>=v_ordered) then
      raise exception 'Order receipt state must match its received line quantities.' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;

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
  if v_receiving_changed and v_status not in ('issued', 'partially_received') and not (
    tg_op='UPDATE' and v_status='fully_received' and pg_trigger_depth()>1 and exists(
      select 1 from public.purchase_order_receipt_reversals r where r.company_id=new.company_id
      and r.purchase_order_line_item_id=new.id and r.xmin::text=pg_current_xact_id()::text
      and r.line_quantities_before=jsonb_build_array(old.quantity_received,old.quantity_damaged,old.quantity_backordered)
      and r.line_quantities_after=jsonb_build_array(new.quantity_received,new.quantity_damaged,new.quantity_backordered)
    )) then
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


commit;

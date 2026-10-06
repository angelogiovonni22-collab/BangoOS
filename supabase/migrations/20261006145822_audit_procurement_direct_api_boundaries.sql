begin;

create function public.guard_procurement_order_lifecycle()
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
create trigger trg_guard_procurement_order_lifecycle before insert or update on public.purchase_orders
for each row execute function public.guard_procurement_order_lifecycle();

create function public.guard_procurement_line_demand()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_plan public.project_material_plan_items%rowtype; v_reserved numeric; v_status text;
begin
  if tg_op='UPDATE' and new.project_material_plan_item_id is not distinct from old.project_material_plan_item_id
    and new.quantity_ordered is not distinct from old.quantity_ordered
    and new.material_id is not distinct from old.material_id and new.project_id is not distinct from old.project_id
    and new.unit_cost is not distinct from old.unit_cost and new.cost_code_id is not distinct from old.cost_code_id then return new; end if;
  select status into v_status from public.purchase_orders
  where company_id=new.company_id and id=new.purchase_order_id for update;
  if not found then raise exception 'Purchase order not found in this company.' using errcode='23503'; end if;
  if v_status<>'draft' then
    raise exception 'Purchase order lines can only be added or financially changed while the order is a draft.' using errcode='23514'; end if;
  if new.project_material_plan_item_id is null then return new; end if;
  select * into v_plan from public.project_material_plan_items
  where company_id=new.company_id and id=new.project_material_plan_item_id for update;
  if not found or v_plan.status='cancelled' then
    raise exception 'Project material requirement is not available.' using errcode='23514'; end if;
  if new.material_id is distinct from v_plan.material_id or new.project_id is distinct from v_plan.project_id then
    raise exception 'Purchase order line must match its project material requirement.' using errcode='23514'; end if;
  select coalesce(sum(li.quantity_ordered),0) into v_reserved
  from public.purchase_order_line_items li join public.purchase_orders po on po.id=li.purchase_order_id and po.company_id=li.company_id
  where li.company_id=new.company_id and li.project_material_plan_item_id=v_plan.id and po.status<>'cancelled'
    and li.id is distinct from new.id;
  if v_reserved+new.quantity_ordered>v_plan.estimated_quantity-v_plan.inventory_quantity then
    raise exception 'Order quantity exceeds the remaining project material requirement.' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger trg_guard_procurement_line_demand before insert or update on public.purchase_order_line_items
for each row execute function public.guard_procurement_line_demand();

create function public.guard_reserved_material_requirement()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_reserved numeric;
begin
  select coalesce(sum(li.quantity_ordered),0) into v_reserved
  from public.purchase_order_line_items li join public.purchase_orders po on po.id=li.purchase_order_id and po.company_id=li.company_id
  where li.company_id=old.company_id and li.project_material_plan_item_id=old.id and po.status<>'cancelled';
  if v_reserved>0 and (new.company_id is distinct from old.company_id or new.project_id is distinct from old.project_id
    or new.material_id is distinct from old.material_id) then
    raise exception 'An ordered material requirement cannot be moved to another company, project or material.' using errcode='23514'; end if;
  if v_reserved>new.estimated_quantity-new.inventory_quantity then
    raise exception 'Material requirement cannot be reduced below its reserved purchase order quantity.' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger trg_guard_reserved_material_requirement before update of company_id,project_id,material_id,estimated_quantity,inventory_quantity
on public.project_material_plan_items for each row execute function public.guard_reserved_material_requirement();

create function public.reconcile_procurement_order_commitments()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_code uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  for v_code in select distinct cost_code_id from public.purchase_order_line_items
    where company_id=new.company_id and purchase_order_id=new.id and cost_code_id is not null order by cost_code_id loop
    perform public.recalculate_procurement_cost_code(new.company_id,v_code);
  end loop;
  return new;
end;
$$;
create trigger trg_reconcile_procurement_order_commitments after update of status on public.purchase_orders
for each row execute function public.reconcile_procurement_order_commitments();

revoke all on function public.guard_procurement_order_lifecycle() from public,anon,authenticated;
revoke all on function public.guard_procurement_line_demand() from public,anon,authenticated;
revoke all on function public.guard_reserved_material_requirement() from public,anon,authenticated;
revoke all on function public.reconcile_procurement_order_commitments() from public,anon,authenticated;
commit;

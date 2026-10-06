begin;
alter table public.procurement_fulfillment_operations
  drop constraint procurement_fulfillment_operations_operation_kind_check,
  add constraint procurement_fulfillment_operations_operation_kind_check
    check(operation_kind in ('receive','allocate','draft','approve','issue','cancel'));

create function public.transition_procurement_order(
  p_company_id uuid,p_operation_id uuid,p_purchase_order_id uuid,p_action text
) returns uuid
language plpgsql security invoker set search_path=pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_operation public.procurement_fulfillment_operations%rowtype;
  v_order public.purchase_orders%rowtype;
  v_payload jsonb := jsonb_build_object('purchaseOrderId',p_purchase_order_id);
  v_cost_code uuid;
begin
  if v_user is null or p_operation_id is null or p_purchase_order_id is null
    or p_action is null or p_action not in ('approve','issue','cancel')
    or not public.has_company_role(p_company_id,
      array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','accountant']) then
    raise exception 'Not authorized for this purchasing transition.' using errcode='42501';
  end if;
  insert into public.procurement_fulfillment_operations(company_id,operation_id,created_by,operation_kind,payload)
  values(p_company_id,p_operation_id,v_user,p_action,v_payload)
  on conflict(company_id,operation_id) do nothing;
  select * into v_operation from public.procurement_fulfillment_operations
  where company_id=p_company_id and operation_id=p_operation_id for update;
  if not found or v_operation.created_by<>v_user then
    raise exception 'Purchasing operation belongs to another user.' using errcode='42501';
  end if;
  if v_operation.operation_kind is distinct from p_action or v_operation.payload is distinct from v_payload then
    raise exception 'Retry must use the original purchasing operation details.' using errcode='23514';
  end if;
  if v_operation.result_id is not null then return v_operation.result_id; end if;
  select * into v_order from public.purchase_orders
  where company_id=p_company_id and id=p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found in this company.' using errcode='23503'; end if;
  if p_action='approve' then
    if v_order.status<>'draft' then raise exception 'Only draft purchase orders can be approved.' using errcode='23514'; end if;
    if not exists(select 1 from public.purchase_order_line_items where company_id=p_company_id and purchase_order_id=v_order.id) then
      raise exception 'A purchase order needs at least one line before approval.' using errcode='23514';
    end if;
    update public.purchase_orders set status='approved',approved_at=now(),approved_by=v_user,updated_by=v_user
    where company_id=p_company_id and id=v_order.id;
  elsif p_action='issue' then
    if v_order.status<>'approved' then raise exception 'Only approved purchase orders can be issued.' using errcode='23514'; end if;
    update public.purchase_orders set status='issued',issued_at=now(),issued_by=v_user,updated_by=v_user
    where company_id=p_company_id and id=v_order.id;
  else
    if v_order.status not in ('draft','approved','issued','partially_received') then
      raise exception 'Only an open purchase order can be cancelled.' using errcode='23514';
    end if;
    update public.purchase_orders set status='cancelled',cancelled_at=now(),cancelled_by=v_user,updated_by=v_user
    where company_id=p_company_id and id=v_order.id;
  end if;
  if not found then raise exception 'Unable to update purchase order state.' using errcode='42501'; end if;
  for v_cost_code in select distinct cost_code_id from public.purchase_order_line_items
    where company_id=p_company_id and purchase_order_id=v_order.id and cost_code_id is not null order by cost_code_id loop
    perform public.recalculate_procurement_cost_code(p_company_id,v_cost_code);
  end loop;
  update public.procurement_fulfillment_operations set result_id=v_order.id
  where company_id=p_company_id and operation_id=p_operation_id;
  return v_order.id;
end;
$$;
revoke all on function public.transition_procurement_order(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.transition_procurement_order(uuid,uuid,uuid,text) to authenticated;
commit;

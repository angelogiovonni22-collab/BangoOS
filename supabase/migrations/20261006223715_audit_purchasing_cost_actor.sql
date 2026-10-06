begin;

create or replace function public.recalculate_procurement_cost_code(p_company_id uuid,p_cost_code_id uuid)
returns void language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_committed numeric; v_actual numeric;
begin
  if auth.uid() is null or not public.has_company_role(p_company_id,
    array['owner','administrator','operations_manager','project_manager','superintendent','office_manager','accountant']) then
    raise exception 'Not authorized to update purchasing costs.' using errcode='42501';
  end if;
  perform 1 from public.cost_codes where company_id=p_company_id and id=p_cost_code_id for update;
  if not found then raise exception 'Cost code not found or not writable.' using errcode='42501'; end if;
  select coalesce(sum(greatest(0,li.quantity_ordered-li.quantity_received-li.quantity_damaged)*li.unit_cost),0)
  into v_committed from public.purchase_order_line_items li
  join public.purchase_orders po on po.id=li.purchase_order_id and po.company_id=li.company_id
  where li.company_id=p_company_id and li.cost_code_id=p_cost_code_id
    and po.status not in ('draft','cancelled','fully_received');
  select coalesce(sum(total_cost),0) into v_actual from public.project_material_allocations
  where company_id=p_company_id and cost_code_id=p_cost_code_id;
  update public.cost_codes set committed_cost=round(v_committed,2),actual_cost=round(v_actual,2),
    updated_by=auth.uid(),updated_at=now()
  where company_id=p_company_id and id=p_cost_code_id;
  if not found then raise exception 'Unable to update purchasing cost totals.' using errcode='42501'; end if;
end;
$$;

revoke all on function public.recalculate_procurement_cost_code(uuid,uuid) from public,anon;
grant execute on function public.recalculate_procurement_cost_code(uuid,uuid) to authenticated;

commit;

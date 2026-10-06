begin;

-- Legacy role arrays are not sufficient authorization: they included read-only
-- roles and ignored explicit materials.manage revocations. Keep existing
-- permissive policies and add a canonical permission requirement to mutations.
-- Reads retain existing financial/reporting access; field request creation is
-- intentionally separate from order approval and inventory fulfillment.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'purchase_orders','purchase_order_line_items','purchase_order_receipts',
    'project_material_allocations','project_material_plan_items',
    'procurement_fulfillment_operations'
  ] loop
    execute format('create policy purchasing_manage_insert_guard on public.%I as restrictive for insert to authenticated with check (public.bos_role_has_permission(company_id,''materials.manage''))',v_table);
    execute format('create policy purchasing_manage_update_guard on public.%I as restrictive for update to authenticated using (public.bos_role_has_permission(company_id,''materials.manage'')) with check (public.bos_role_has_permission(company_id,''materials.manage''))',v_table);
    execute format('create policy purchasing_manage_delete_guard on public.%I as restrictive for delete to authenticated using (public.bos_role_has_permission(company_id,''materials.manage''))',v_table);
  end loop;
end $$;

commit;

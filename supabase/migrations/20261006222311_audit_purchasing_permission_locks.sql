begin;

-- The canonical material-management permission already includes project managers.
-- Keep actor and same-company supplier constraints on their inventory updates.
create policy materials_purchasing_manager_update on public.materials
for update to authenticated
using (public.bos_role_has_permission(company_id,'materials.manage'))
with check (
  public.bos_role_has_permission(company_id,'materials.manage')
  and (updated_by is null or updated_by=auth.uid())
  and (preferred_vendor_id is null or exists(
    select 1 from public.vendors v where v.id=materials.preferred_vendor_id and v.company_id=materials.company_id
  ))
);

-- SELECT FOR UPDATE requires an UPDATE USING policy. These policies authorize
-- purchasing locks, while WITH CHECK false grants no supplier/price mutations.
create policy vendors_purchasing_lock on public.vendors
for update to authenticated
using (public.bos_role_has_permission(company_id,'materials.manage'))
with check (false);
create policy supplier_price_entries_purchasing_lock on public.supplier_price_entries
for update to authenticated
using (public.bos_role_has_permission(company_id,'materials.manage'))
with check (false);

create policy cost_codes_purchasing_totals_update on public.cost_codes
for update to authenticated
using (public.bos_role_has_permission(company_id,'materials.manage'))
with check (public.bos_role_has_permission(company_id,'materials.manage') and (updated_by is null or updated_by=auth.uid()));

-- Roles without existing general financial UPDATE rights may only synchronize
-- purchasing-derived totals. They cannot edit budgets, ownership or other data.
create function public.guard_purchasing_derived_cost_update()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare v_committed numeric; v_actual numeric;
begin
  if public.has_company_role(old.company_id,
    array['owner','administrator','operations_manager','office_manager','accountant','estimator']) then return new; end if;
  if not public.bos_role_has_permission(old.company_id,'materials.manage') or
    (to_jsonb(new)-array['committed_cost','actual_cost','updated_at','updated_by'])
      is distinct from (to_jsonb(old)-array['committed_cost','actual_cost','updated_at','updated_by']) then
    raise exception 'This role can synchronize purchasing totals but cannot edit financial cost-code data.' using errcode='42501';
  end if;
  select coalesce(sum(greatest(0,li.quantity_ordered-li.quantity_received-li.quantity_damaged)*li.unit_cost),0)
    into v_committed from public.purchase_order_line_items li
    join public.purchase_orders po on po.id=li.purchase_order_id and po.company_id=li.company_id
    where li.company_id=old.company_id and li.cost_code_id=old.id and po.status not in ('draft','cancelled','fully_received');
  select coalesce(sum(total_cost),0) into v_actual from public.project_material_allocations
    where company_id=old.company_id and cost_code_id=old.id;
  if new.committed_cost is distinct from round(v_committed,2) or new.actual_cost is distinct from round(v_actual,2) then
    raise exception 'Purchasing cost totals must match their order and allocation records.' using errcode='23514';
  end if;
  new.updated_by:=auth.uid(); new.updated_at:=now();
  return new;
end;
$$;
create trigger trg_guard_purchasing_derived_cost_update before update on public.cost_codes
for each row execute function public.guard_purchasing_derived_cost_update();
revoke all on function public.guard_purchasing_derived_cost_update() from public,anon,authenticated;

commit;

begin;

create or replace function public.guard_project_material_plan_receiving()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
begin
  if new.project_material_plan_item_id is null then
    return new;
  end if;

  if new.quantity_received <= old.quantity_received
     and new.quantity_damaged <= old.quantity_damaged then
    return new;
  end if;

  select po.status
    into v_status
  from public.purchase_orders po
  where po.id = new.purchase_order_id
    and po.company_id = new.company_id;

  if v_status is null then
    raise exception 'Linked purchase order was not found.' using errcode = '23503';
  end if;

  if v_status not in ('issued', 'partially_received') then
    raise exception 'Project material plan receipts require an issued purchase order.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_project_material_plan_receiving on public.purchase_order_line_items;
create trigger trg_guard_project_material_plan_receiving
before update of quantity_received, quantity_damaged
on public.purchase_order_line_items
for each row
execute function public.guard_project_material_plan_receiving();

comment on function public.guard_project_material_plan_receiving() is
  'Prevents project material-plan receiving from bypassing draft approval and purchase-order issuance.';

commit;

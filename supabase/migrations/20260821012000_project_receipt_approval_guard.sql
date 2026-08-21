begin;

create or replace function public.can_manage_project_receipt_cost(p_company_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = p_company_id
      and p.role in ('owner','administrator','operations_manager','project_manager','office_manager','accountant')
  );
$$;

create or replace function public.enforce_project_receipt_approval_role()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (old.status = 'approved' or new.status = 'approved')
     and not public.can_manage_project_receipt_cost(new.company_id) then
    raise exception 'You do not have permission to change approved project receipt costs.';
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := coalesce(new.approved_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists project_receipts_approval_guard on public.project_receipts;
create trigger project_receipts_approval_guard
before update on public.project_receipts
for each row execute function public.enforce_project_receipt_approval_role();

-- Extracted line items can be created while a receipt is awaiting review, but once the
-- receipt is approved they become financial evidence and only financial/project managers
-- may mutate them. This prevents a field user from changing approved receipt details through
-- a direct database client while preserving normal upload/extraction workflows.
drop policy if exists project_receipt_items_insert on public.project_receipt_items;
drop policy if exists project_receipt_items_update on public.project_receipt_items;
drop policy if exists project_receipt_items_delete on public.project_receipt_items;

create policy project_receipt_items_insert on public.project_receipt_items
for insert to authenticated
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipt_items.company_id)
  and exists (
    select 1
    from public.project_receipts r
    where r.id = project_receipt_items.receipt_id
      and r.company_id = project_receipt_items.company_id
      and r.project_id = project_receipt_items.project_id
      and (r.status <> 'approved' or public.can_manage_project_receipt_cost(r.company_id))
  )
);

create policy project_receipt_items_update on public.project_receipt_items
for update to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipt_items.company_id)
  and exists (
    select 1 from public.project_receipts r
    where r.id = project_receipt_items.receipt_id
      and r.company_id = project_receipt_items.company_id
      and r.project_id = project_receipt_items.project_id
      and (r.status <> 'approved' or public.can_manage_project_receipt_cost(r.company_id))
  )
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipt_items.company_id)
  and exists (
    select 1 from public.project_receipts r
    where r.id = project_receipt_items.receipt_id
      and r.company_id = project_receipt_items.company_id
      and r.project_id = project_receipt_items.project_id
      and (r.status <> 'approved' or public.can_manage_project_receipt_cost(r.company_id))
  )
);

create policy project_receipt_items_delete on public.project_receipt_items
for delete to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.company_id = project_receipt_items.company_id)
  and exists (
    select 1 from public.project_receipts r
    where r.id = project_receipt_items.receipt_id
      and r.company_id = project_receipt_items.company_id
      and r.project_id = project_receipt_items.project_id
      and (r.status <> 'approved' or public.can_manage_project_receipt_cost(r.company_id))
  )
);

commit;

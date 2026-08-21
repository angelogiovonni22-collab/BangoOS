begin;

create or replace function public.enforce_project_receipt_approval_role()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = new.company_id
        and p.role in ('owner','administrator','operations_manager','project_manager','office_manager','accountant')
    ) then
      raise exception 'You do not have permission to approve project receipt costs.';
    end if;

    new.approved_by := auth.uid();
    new.approved_at := coalesce(new.approved_at, now());
  end if;

  if old.status = 'approved' and new.status <> 'approved' then
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = new.company_id
        and p.role in ('owner','administrator','operations_manager','project_manager','office_manager','accountant')
    ) then
      raise exception 'You do not have permission to reverse an approved project receipt cost.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists project_receipts_approval_guard on public.project_receipts;
create trigger project_receipts_approval_guard
before update on public.project_receipts
for each row execute function public.enforce_project_receipt_approval_role();

commit;

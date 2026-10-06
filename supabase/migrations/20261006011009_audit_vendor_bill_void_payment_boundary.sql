-- Cancel unpaid AP bills without deleting audit evidence or bypassing payment state.
create or replace function public.guard_vendor_bill_void()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'voided' and old.status is distinct from 'voided' then
    if old.status = 'paid' or old.amount_paid > 0 or new.amount_paid > 0
      or exists (select 1 from public.vendor_bill_payments where company_id = old.company_id and vendor_bill_id = old.id) then
      raise exception 'Bills with recorded payments cannot be voided';
    end if;
    new.voided_at := coalesce(new.voided_at, now());
    new.voided_by := coalesce(new.voided_by, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.guard_vendor_bill_void() from public, anon, authenticated;
create trigger trg_vendor_bill_void_boundary
before update on public.vendor_bills
for each row execute function public.guard_vendor_bill_void();

create or replace function public.guard_vendor_bill_payment_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_total numeric;
  v_paid numeric;
begin
  if tg_op = 'UPDATE' and (new.company_id is distinct from old.company_id or new.vendor_bill_id is distinct from old.vendor_bill_id) then
    raise exception 'A recorded payment cannot be moved to another bill';
  end if;
  -- Serializes payment writes with bill approval/void and concurrent payments.
  select status, total_amount into v_status, v_total
  from public.vendor_bills
  where company_id = new.company_id and id = new.vendor_bill_id
  for update;
  if not found then raise exception 'Vendor bill is unavailable'; end if;
  if v_status not in ('approved', 'partially_paid', 'paid') or (tg_op = 'INSERT' and v_status = 'paid') then
    raise exception 'Approve the bill before recording payment; voided bills cannot receive payments';
  end if;
  select coalesce(sum(amount), 0) into v_paid
  from public.vendor_bill_payments
  where company_id = new.company_id and vendor_bill_id = new.vendor_bill_id and id <> new.id;
  if v_paid + new.amount > v_total then
    raise exception 'Vendor bill payments exceed bill total';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_vendor_bill_payment_state() from public, anon, authenticated;
create trigger trg_vendor_bill_payment_state_boundary
before insert or update on public.vendor_bill_payments
for each row execute function public.guard_vendor_bill_payment_state();

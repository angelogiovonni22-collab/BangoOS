begin;

-- Atomic operational entry point for AP vendor bills.
-- RLS and company-role checks remain the authorization boundary; this function
-- simply prevents a bill header from being left behind if its first cost line fails.
create or replace function public.create_vendor_bill_with_line(
  p_company_id uuid,
  p_vendor_id uuid,
  p_project_id uuid,
  p_bill_number text,
  p_vendor_invoice_number text,
  p_bill_date date,
  p_due_date date,
  p_description text,
  p_category text,
  p_amount numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bill_id uuid;
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_company_role(
    p_company_id,
    array['owner','administrator','operations_manager','office_manager','accountant']
  ) then
    raise exception 'Finance write access required';
  end if;

  if p_vendor_id is null then
    raise exception 'Vendor is required';
  end if;
  if btrim(coalesce(p_bill_number, '')) = '' then
    raise exception 'Bill number is required';
  end if;
  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Bill line description is required';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Bill amount must be greater than zero';
  end if;
  if p_due_date is not null and p_bill_date is not null and p_due_date < p_bill_date then
    raise exception 'Due date cannot be before bill date';
  end if;

  insert into public.vendor_bills (
    company_id,
    vendor_id,
    project_id,
    bill_number,
    vendor_invoice_number,
    bill_date,
    due_date,
    status,
    subtotal_amount,
    tax_amount,
    retainage_amount,
    total_amount,
    amount_paid,
    created_by,
    updated_by
  ) values (
    p_company_id,
    p_vendor_id,
    p_project_id,
    btrim(p_bill_number),
    nullif(btrim(coalesce(p_vendor_invoice_number, '')), ''),
    p_bill_date,
    p_due_date,
    'draft',
    p_amount,
    0,
    0,
    p_amount,
    0,
    v_actor_id,
    v_actor_id
  ) returning id into v_bill_id;

  insert into public.vendor_bill_line_items (
    company_id,
    vendor_bill_id,
    project_id,
    description,
    quantity,
    unit_cost,
    line_amount,
    category,
    created_by,
    updated_by
  ) values (
    p_company_id,
    v_bill_id,
    p_project_id,
    btrim(p_description),
    1,
    p_amount,
    p_amount,
    coalesce(nullif(btrim(p_category), ''), 'other'),
    v_actor_id,
    v_actor_id
  );

  return v_bill_id;
end;
$$;

revoke all on function public.create_vendor_bill_with_line(uuid,uuid,uuid,text,text,date,date,text,text,numeric) from public;
grant execute on function public.create_vendor_bill_with_line(uuid,uuid,uuid,text,text,date,date,text,text,numeric) to authenticated;

commit;

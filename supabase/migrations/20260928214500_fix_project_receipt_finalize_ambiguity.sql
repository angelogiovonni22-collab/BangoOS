begin;

create or replace function public.finalize_project_receipt(
  p_receipt_id uuid,
  p_vendor_name text,
  p_receipt_number text,
  p_purchased_at date,
  p_subtotal numeric,
  p_tax_amount numeric,
  p_total_amount numeric,
  p_payment_method text,
  p_items jsonb default '[]'::jsonb
)
returns table(receipt_id uuid, status text, approved_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_receipt public.project_receipts%rowtype;
  v_profile public.profiles%rowtype;
  v_item jsonb;
  v_description text;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_category text;
  v_cost_code_id uuid;
begin
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'Receipt total must be zero or greater.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Receipt items must be a JSON array.';
  end if;

  select * into v_receipt
  from public.project_receipts r
  where r.id = p_receipt_id
  for update;

  if not found then
    raise exception 'Receipt not found.';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = auth.uid()
    and p.company_id = v_receipt.company_id;

  if not found then
    raise exception 'Unauthorized.';
  end if;

  if v_receipt.status = 'rejected' then
    raise exception 'Rejected receipts cannot be approved.';
  end if;

  update public.project_receipts r
  set vendor_name = nullif(btrim(coalesce(p_vendor_name, '')), ''),
      receipt_number = nullif(btrim(coalesce(p_receipt_number, '')), ''),
      purchased_at = p_purchased_at,
      subtotal = p_subtotal,
      tax_amount = p_tax_amount,
      total_amount = p_total_amount,
      payment_method = nullif(btrim(coalesce(p_payment_method, '')), ''),
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = now()
  where r.id = p_receipt_id;

  delete from public.project_receipt_items pri
  where pri.receipt_id = p_receipt_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_description := nullif(btrim(coalesce(v_item->>'description', '')), '');
    if v_description is null then
      continue;
    end if;

    v_quantity := greatest(coalesce(nullif(v_item->>'quantity', '')::numeric, 1), 0.001);
    v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
    v_line_total := greatest(coalesce(nullif(v_item->>'line_total', '')::numeric, coalesce(v_unit_price, 0) * v_quantity, 0), 0);
    v_category := coalesce(nullif(v_item->>'category', ''), 'materials');
    if v_category not in ('materials','tools','equipment','safety','consumables','tax','other') then
      v_category := 'other';
    end if;
    v_cost_code_id := nullif(v_item->>'cost_code_id', '')::uuid;

    insert into public.project_receipt_items (
      company_id, project_id, receipt_id, description, quantity, unit_price, line_total, category, cost_code_id, extraction_confidence
    ) values (
      v_receipt.company_id,
      v_receipt.project_id,
      p_receipt_id,
      v_description,
      v_quantity,
      v_unit_price,
      v_line_total,
      v_category,
      v_cost_code_id,
      case when (v_item->>'confidence') ~ '^[0-9]+(\.[0-9]+)?$' then least(greatest((v_item->>'confidence')::numeric, 0), 1) else null end
    );
  end loop;

  return query
  select r.id, r.status, r.approved_at
  from public.project_receipts r
  where r.id = p_receipt_id;
end;
$$;

grant execute on function public.finalize_project_receipt(uuid,text,text,date,numeric,numeric,numeric,text,jsonb) to authenticated;

commit;

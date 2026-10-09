begin;

create table public.invoice_payment_operations (
  company_id uuid not null references public.companies(id) on delete cascade,
  operation_id uuid not null,
  invoice_id uuid not null,
  created_by uuid not null references public.profiles(id),
  payload jsonb not null,
  result_payment_id uuid,
  created_at timestamptz not null default now(),
  primary key (company_id, operation_id),
  foreign key (invoice_id, company_id) references public.invoices(id, company_id) on delete cascade
);

alter table public.invoice_payment_operations enable row level security;
create policy invoice_payment_operations_access
on public.invoice_payment_operations for all to authenticated
using (
  created_by = auth.uid()
  and public.bos_role_has_permission(company_id, 'invoices.manage')
)
with check (
  created_by = auth.uid()
  and public.bos_role_has_permission(company_id, 'invoices.manage')
);
revoke all on public.invoice_payment_operations from public, anon;
grant select, insert, update on public.invoice_payment_operations to authenticated;

create function public.lookup_invoice_payment_operation(
  p_company_id uuid,
  p_operation_id uuid,
  p_invoice_id uuid,
  p_payload jsonb
) returns uuid
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_operation public.invoice_payment_operations%rowtype;
begin
  if v_user is null or p_operation_id is null or p_invoice_id is null
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not public.bos_role_has_permission(p_company_id, 'invoices.manage') then
    raise exception 'Not authorized for this invoice payment operation.' using errcode='42501';
  end if;

  select * into v_operation
  from public.invoice_payment_operations
  where company_id = p_company_id and operation_id = p_operation_id;

  if not found then return null; end if;
  if v_operation.created_by <> v_user then
    raise exception 'Invoice payment operation belongs to another user.' using errcode='42501';
  end if;
  if v_operation.invoice_id is distinct from p_invoice_id or v_operation.payload is distinct from p_payload then
    raise exception 'Retry must use the original invoice payment details.' using errcode='23514';
  end if;

  return v_operation.result_payment_id;
end;
$$;

create function public.record_invoice_payment_idempotent(
  p_company_id uuid,
  p_operation_id uuid,
  p_invoice_id uuid,
  p_payload jsonb
) returns uuid
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_operation public.invoice_payment_operations%rowtype;
  v_invoice public.invoices%rowtype;
  v_payment_id uuid;
  v_amount numeric;
  v_payment_date date;
  v_method text;
  v_reference text;
  v_notes text;
begin
  if v_user is null or p_operation_id is null or p_invoice_id is null
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not public.bos_role_has_permission(p_company_id, 'invoices.manage') then
    raise exception 'Not authorized for this invoice payment operation.' using errcode='42501';
  end if;

  insert into public.invoice_payment_operations(company_id, operation_id, invoice_id, created_by, payload)
  values(p_company_id, p_operation_id, p_invoice_id, v_user, p_payload)
  on conflict(company_id, operation_id) do nothing;

  select * into v_operation
  from public.invoice_payment_operations
  where company_id = p_company_id and operation_id = p_operation_id
  for update;

  if not found or v_operation.created_by <> v_user then
    raise exception 'Invoice payment operation belongs to another user.' using errcode='42501';
  end if;
  if v_operation.invoice_id is distinct from p_invoice_id or v_operation.payload is distinct from p_payload then
    raise exception 'Retry must use the original invoice payment details.' using errcode='23514';
  end if;
  if v_operation.result_payment_id is not null then
    return v_operation.result_payment_id;
  end if;

  select * into v_invoice
  from public.invoices
  where company_id = p_company_id and id = p_invoice_id
  for update;
  if not found then
    raise exception 'Invoice not found.' using errcode='23503';
  end if;
  if v_invoice.status in ('void', 'paid') then
    raise exception 'Payments cannot be recorded against a paid or void invoice.' using errcode='23514';
  end if;

  begin
    v_amount := (p_payload->>'amount')::numeric;
    v_payment_date := (p_payload->>'paymentDate')::date;
  exception when others then
    raise exception 'Invoice payment details are invalid.' using errcode='23514';
  end;
  v_method := nullif(btrim(p_payload->>'method'), '');
  v_reference := nullif(btrim(p_payload->>'referenceNumber'), '');
  v_notes := nullif(btrim(p_payload->>'notes'), '');

  if v_amount is null or v_amount <= 0 or v_amount::text in ('NaN','Infinity','-Infinity') or v_payment_date is null then
    raise exception 'Invoice payment amount and date are invalid.' using errcode='23514';
  end if;
  if v_amount > greatest(coalesce(v_invoice.total_amount, 0) - coalesce(v_invoice.amount_paid, 0), 0) + 0.005 then
    raise exception 'Payment cannot exceed the invoice balance.' using errcode='23514';
  end if;

  insert into public.invoice_payment_history(
    company_id, invoice_id, payment_date, amount, method,
    reference_number, status, notes, created_by
  ) values (
    p_company_id, p_invoice_id, v_payment_date, v_amount,
    coalesce(v_method, 'manual'), v_reference, 'recorded', v_notes, v_user
  ) returning id into v_payment_id;

  update public.invoice_payment_operations
  set result_payment_id = v_payment_id
  where company_id = p_company_id and operation_id = p_operation_id;

  return v_payment_id;
end;
$$;

revoke all on function public.lookup_invoice_payment_operation(uuid,uuid,uuid,jsonb) from public, anon;
revoke all on function public.record_invoice_payment_idempotent(uuid,uuid,uuid,jsonb) from public, anon;
grant execute on function public.lookup_invoice_payment_operation(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.record_invoice_payment_idempotent(uuid,uuid,uuid,jsonb) to authenticated;

comment on function public.record_invoice_payment_idempotent(uuid,uuid,uuid,jsonb) is
  'Atomic retry-safe manual invoice receipt recording. Same operation+payload returns the original receipt; changed payload is rejected.';

commit;

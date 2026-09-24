create or replace function public.trg_invoice_payment_history_sync_invoice_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_invoice_id uuid;
  v_company_id uuid;
  v_total_paid numeric(14,2);
  v_invoice_total numeric(14,2);
  v_latest_payment_date date;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  v_company_id := coalesce(new.company_id, old.company_id);

  select
    coalesce(sum(ph.amount), 0),
    max(ph.payment_date)
    into v_total_paid, v_latest_payment_date
  from public.invoice_payment_history ph
  where ph.invoice_id = v_invoice_id
    and ph.company_id = v_company_id
    and ph.status in ('recorded', 'pending');

  select i.total_amount
    into v_invoice_total
  from public.invoices i
  where i.id = v_invoice_id
    and i.company_id = v_company_id;

  update public.invoices i
     set amount_paid = greatest(0, least(v_total_paid, coalesce(v_invoice_total, 0))),
         status = case
           when i.status = 'void' then 'void'
           when i.status = 'draft' then 'draft'
           when greatest(0, least(v_total_paid, coalesce(v_invoice_total, 0))) = 0 then 'sent'
           when greatest(0, least(v_total_paid, coalesce(v_invoice_total, 0))) >= coalesce(v_invoice_total, 0) then 'paid'
           else 'partially_paid'
         end,
         paid_date = case
           when greatest(0, least(v_total_paid, coalesce(v_invoice_total, 0))) >= coalesce(v_invoice_total, 0)
             then coalesce(i.paid_date, v_latest_payment_date, current_date)
           else null
         end,
         updated_at = now()
   where i.id = v_invoice_id
     and i.company_id = v_company_id;

  return coalesce(new, old);
end;
$$;

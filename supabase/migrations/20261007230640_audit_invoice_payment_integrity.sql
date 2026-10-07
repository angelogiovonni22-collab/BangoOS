begin;

-- Acquire the same invoice lock before both the existing deposit compliance
-- trigger and the balance rollup. Keep current RLS and historical draft receipts.
create function public.guard_invoice_payment_integrity()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
declare
 v_invoice uuid:=coalesce(new.invoice_id,old.invoice_id);
 v_company uuid:=coalesce(new.company_id,old.company_id);
 v_status text; v_total numeric; v_stored_paid numeric; v_existing numeric; v_prior numeric;
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.company_id is distinct from old.company_id or new.invoice_id is distinct from old.invoice_id) then
   raise exception 'A payment history record cannot be moved to another invoice or company';
 end if;
 select i.status,i.total_amount,i.amount_paid into v_status,v_total,v_stored_paid
 from public.invoices i where i.id=v_invoice and i.company_id=v_company for update;
 if not found then
   if tg_op='DELETE' then return old; end if; -- Preserve parent/company cascade deletes.
   raise exception 'Invoice is unavailable';
 end if;
 if tg_op='DELETE' then return old; end if;
 if new.status in ('recorded','pending') and (v_status='void' or (tg_op='INSERT' and v_status='paid')) then
   raise exception 'Payments cannot be recorded against a paid or void invoice';
 end if;
 select coalesce(sum(ph.amount),0),coalesce(sum(ph.amount) filter(where ph.id<>new.id),0)
 into v_existing,v_prior from public.invoice_payment_history ph
 where ph.invoice_id=v_invoice and ph.company_id=v_company and ph.status in ('recorded','pending');
 -- Do not silently erase a legacy paid amount that has no receipt evidence.
 -- INSERT batches only increase recorded totals, so this also permits bulk receipts.
 if tg_op='INSERT' and v_stored_paid>v_existing then
   raise exception 'Invoice payment history does not reconcile to the existing paid balance; review it before recording another payment';
 end if;
 if v_prior+(case when new.status in ('recorded','pending') then new.amount else 0 end)>v_total then
   raise exception 'Payment cannot exceed the invoice balance';
 end if;
 return new;
end $$;
revoke all on function public.guard_invoice_payment_integrity() from public,anon,authenticated;
create trigger trg_audit_invoice_payment_integrity
before insert or update or delete on public.invoice_payment_history
for each row execute function public.guard_invoice_payment_integrity();

create or replace function public.trg_invoice_payment_history_sync_invoice_fn()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
declare
 v_invoice uuid:=coalesce(new.invoice_id,old.invoice_id);
 v_company uuid:=coalesce(new.company_id,old.company_id);
 v_total numeric; v_paid numeric; v_latest date;
begin
 select i.total_amount into v_total from public.invoices i
 where i.id=v_invoice and i.company_id=v_company for update;
 if not found then
   if tg_op='DELETE' then return old; end if;
   raise exception 'Invoice is unavailable';
 end if;
 select coalesce(sum(ph.amount),0),max(ph.payment_date) into v_paid,v_latest
 from public.invoice_payment_history ph where ph.invoice_id=v_invoice
 and ph.company_id=v_company and ph.status in ('recorded','pending');
 if v_paid>v_total then raise exception 'Payment cannot exceed the invoice balance'; end if;
 update public.invoices i set amount_paid=v_paid,
 status=case when i.status='void' then 'void' when i.status='draft' then 'draft'
   when v_paid=0 then 'sent' when v_paid>=v_total then 'paid' else 'partially_paid' end,
 paid_date=case when v_paid>=v_total then coalesce(i.paid_date,v_latest,current_date) else null end,
 updated_at=now() where i.id=v_invoice and i.company_id=v_company;
 return coalesce(new,old);
end $$;
revoke all on function public.trg_invoice_payment_history_sync_invoice_fn() from public,anon,authenticated;
commit;

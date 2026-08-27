begin;

alter table public.vendor_bills
  add column if not exists match_status text not null default 'needs_review',
  add column if not exists match_checked_at timestamptz null,
  add column if not exists match_approved_at timestamptz null,
  add column if not exists match_approved_by uuid null;

alter table public.vendor_bill_line_items
  add column if not exists match_status text not null default 'needs_review',
  add column if not exists po_quantity numeric(14,3) null,
  add column if not exists received_quantity numeric(14,3) null,
  add column if not exists po_unit_cost numeric(14,4) null,
  add column if not exists price_variance numeric(14,4) null,
  add column if not exists quantity_variance numeric(14,3) null,
  add column if not exists match_notes text null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='vendor_bills_match_status_check') then
    alter table public.vendor_bills add constraint vendor_bills_match_status_check check (match_status in ('matched','price_variance','quantity_variance','missing_receipt','missing_po','duplicate_invoice','needs_review'));
  end if;
  if not exists (select 1 from pg_constraint where conname='vendor_bill_line_items_match_status_check') then
    alter table public.vendor_bill_line_items add constraint vendor_bill_line_items_match_status_check check (match_status in ('matched','price_variance','quantity_variance','missing_receipt','missing_po','duplicate_invoice','needs_review'));
  end if;
end $$;

create index if not exists vendor_bills_match_queue_idx on public.vendor_bills(company_id, match_status, due_date);
create index if not exists vendor_bill_line_items_match_idx on public.vendor_bill_line_items(company_id, match_status, vendor_bill_id);

comment on column public.vendor_bills.match_status is 'Three-way PO / receiving / vendor-invoice reconciliation state. Matched does not itself authorize payment.';
comment on column public.vendor_bills.match_approved_at is 'Explicit human approval of the reconciliation result; payment remains a separate explicit action.';

commit;

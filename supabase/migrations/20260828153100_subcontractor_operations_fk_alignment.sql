begin;

alter table public.subcontractor_payment_applications
  drop constraint if exists subcontractor_payment_applications_vendor_bill_id_company_id_fkey;

alter table public.subcontractor_payment_applications
  add constraint subcontractor_payment_applications_vendor_bill_id_fkey
  foreign key (vendor_bill_id) references public.vendor_bills(id) on delete set null;

commit;

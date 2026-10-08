begin;

-- Existing company/parent/view policies remain in force. Mutations additionally
-- require the canonical active-membership invoices.manage permission, including
-- explicit tenant overrides. Never grant authority through invoice visibility.

create policy bos_audit_invoice_manage_insert on public.invoices
as restrictive for insert to authenticated
with check (public.bos_role_has_permission(company_id,'invoices.manage'));

create policy bos_audit_invoice_manage_update on public.invoices
as restrictive for update to authenticated
using (public.bos_role_has_permission(company_id,'invoices.manage'))
with check (public.bos_role_has_permission(company_id,'invoices.manage'));

create policy bos_audit_invoice_manage_delete on public.invoices
as restrictive for delete to authenticated
using (public.bos_role_has_permission(company_id,'invoices.manage'));

create policy bos_audit_invoice_manage_insert on public.invoice_line_items
as restrictive for insert to authenticated
with check (public.bos_role_has_permission(company_id,'invoices.manage'));

create policy bos_audit_invoice_manage_update on public.invoice_line_items
as restrictive for update to authenticated
using (public.bos_role_has_permission(company_id,'invoices.manage'))
with check (public.bos_role_has_permission(company_id,'invoices.manage'));

create policy bos_audit_invoice_manage_delete on public.invoice_line_items
as restrictive for delete to authenticated
using (public.bos_role_has_permission(company_id,'invoices.manage'));

create policy bos_audit_invoice_manage_insert on public.invoice_payment_history
as restrictive for insert to authenticated
with check (public.bos_role_has_permission(company_id,'invoices.manage'));

create policy bos_audit_invoice_manage_update on public.invoice_payment_history
as restrictive for update to authenticated
using (public.bos_role_has_permission(company_id,'invoices.manage'))
with check (public.bos_role_has_permission(company_id,'invoices.manage'));

create policy bos_audit_invoice_manage_delete on public.invoice_payment_history
as restrictive for delete to authenticated
using (public.bos_role_has_permission(company_id,'invoices.manage'));

commit;

begin;

-- Trade-partner assignments drive subcontract legal terms and mobilization. Same-
-- company membership alone is not sufficient authorization to mutate them.
alter table public.trade_partner_assignments enable row level security;

drop policy if exists bos_internal_permission_select_guard on public.trade_partner_assignments;
create policy bos_internal_permission_select_guard
on public.trade_partner_assignments
as restrictive
for select
to authenticated
using (public.bos_role_has_permission(company_id, 'projects.view'));

drop policy if exists bos_internal_permission_insert_guard on public.trade_partner_assignments;
create policy bos_internal_permission_insert_guard
on public.trade_partner_assignments
as restrictive
for insert
to authenticated
with check (public.bos_role_has_permission(company_id, 'projects.manage'));

drop policy if exists bos_internal_permission_update_guard on public.trade_partner_assignments;
create policy bos_internal_permission_update_guard
on public.trade_partner_assignments
as restrictive
for update
to authenticated
using (public.bos_role_has_permission(company_id, 'projects.manage'))
with check (public.bos_role_has_permission(company_id, 'projects.manage'));

drop policy if exists bos_internal_permission_delete_guard on public.trade_partner_assignments;
create policy bos_internal_permission_delete_guard
on public.trade_partner_assignments
as restrictive
for delete
to authenticated
using (public.bos_role_has_permission(company_id, 'projects.manage'));

commit;

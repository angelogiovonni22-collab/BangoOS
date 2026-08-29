begin;

create or replace function public.delete_mistaken_trade_partner_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
begin
  select * into v_assignment from public.trade_partner_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Trade Partner assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id, array['owner','administrator']) then
    raise exception 'Only an owner or administrator can delete a mistaken assignment';
  end if;
  if v_assignment.contract_status <> 'draft' or v_assignment.assignment_status = 'active' or v_assignment.mobilization_status <> 'not_cleared' then
    raise exception 'This assignment has progressed too far to delete. Use Remove, End, Terminate, or Replace instead';
  end if;
  if exists(select 1 from public.subcontractor_change_orders where assignment_id=p_assignment_id)
     or exists(select 1 from public.subcontractor_payment_applications where assignment_id=p_assignment_id)
     or exists(select 1 from public.subcontractor_compliance_documents where assignment_id=p_assignment_id)
     or exists(select 1 from public.subcontractor_signature_events where assignment_id=p_assignment_id)
     or exists(select 1 from public.project_subcontract_work_authorizations where assignment_id=p_assignment_id)
     or exists(select 1 from public.trade_partner_messages where company_id=v_assignment.company_id and project_id=v_assignment.project_id and vendor_id=v_assignment.vendor_id) then
    raise exception 'This assignment has history and cannot be deleted. Use Remove, End, Terminate, or Replace instead';
  end if;
  delete from public.trade_partner_assignments where id=p_assignment_id;
end;
$$;

grant execute on function public.delete_mistaken_trade_partner_assignment(uuid) to authenticated;

commit;

begin;

create or replace function public.replace_trade_partner_assignment_with_vendor(
  p_assignment_id uuid,
  p_replacement_vendor_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_vendor public.vendors%rowtype;
  v_new_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
begin
  select * into v_assignment from public.trade_partner_assignments where id=p_assignment_id for update;
  if not found then raise exception 'Trade Partner assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id, array['owner','administrator','operations_manager','office_manager','project_manager','superintendent']) then
    raise exception 'Not authorized';
  end if;
  if v_reason is null then raise exception 'A replacement reason is required'; end if;
  if v_assignment.lifecycle_status <> 'active' then raise exception 'This Trade Partner assignment is already closed'; end if;

  select * into v_vendor
  from public.vendors
  where id=p_replacement_vendor_id and company_id=v_assignment.company_id;
  if not found then raise exception 'Replacement Trade Partner not found'; end if;
  if coalesce(v_vendor.rehire_status,'approved')='do_not_rehire' then raise exception 'This Trade Partner is marked Do Not Rehire'; end if;
  if p_replacement_vendor_id=v_assignment.vendor_id then raise exception 'Select a different Trade Partner'; end if;
  if exists(
    select 1 from public.trade_partner_assignments
    where company_id=v_assignment.company_id
      and project_id=v_assignment.project_id
      and vendor_id=p_replacement_vendor_id
      and lifecycle_status='active'
      and assignment_status in ('active','inactive')
  ) then raise exception 'The replacement Trade Partner is already assigned to this project'; end if;

  insert into public.trade_partner_assignments(
    company_id, project_id, vendor_id, trade_name, scope_of_work,
    primary_contact_name, primary_contact_phone, primary_contact_email,
    contract_status, contract_amount, payment_terms, retainage_percent,
    start_date, target_completion_date, crew_size, assignment_status, notes,
    lifecycle_status, created_by, updated_by, created_at, updated_at
  ) values (
    v_assignment.company_id, v_assignment.project_id, v_vendor.id, v_assignment.trade_name, v_assignment.scope_of_work,
    nullif(btrim(concat_ws(' ',v_vendor.first_name,v_vendor.last_name)),''), coalesce(v_vendor.mobile,v_vendor.phone), v_vendor.email,
    'draft', null, v_vendor.payment_terms, v_assignment.retainage_percent,
    greatest(current_date, coalesce(v_assignment.start_date,current_date)), v_assignment.target_completion_date, null, 'inactive',
    concat('Replacement assignment created from ',v_assignment.id,'. Review compensation and send agreement before mobilization.'),
    'active', auth.uid(), auth.uid(), now(), now()
  ) returning id into v_new_id;

  update public.trade_partner_assignments
  set assignment_status='archived',
      lifecycle_status='replaced',
      lifecycle_reason=v_reason,
      lifecycle_ended_at=now(),
      lifecycle_ended_by=auth.uid(),
      replaced_by_assignment_id=v_new_id,
      updated_by=auth.uid(),
      updated_at=now()
  where id=v_assignment.id;

  return v_new_id;
end;
$$;

grant execute on function public.replace_trade_partner_assignment_with_vendor(uuid,uuid,text) to authenticated;

commit;

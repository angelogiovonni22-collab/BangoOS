begin;

-- Make partner billing assignment-specific so multiple subcontracts on one project
-- cannot be resolved ambiguously.
drop function if exists public.submit_my_subcontractor_payment_application(uuid,numeric,numeric,text,date);
create or replace function public.submit_my_subcontractor_payment_application(
  p_project_id uuid,
  p_amount_requested numeric,
  p_retainage_amount numeric default 0,
  p_description text default null,
  p_period_through date default current_date,
  p_assignment_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_id uuid:=gen_random_uuid();
  v_number text;
  v_commitment numeric;
  v_prior numeric;
begin
  select a.* into v_assignment
  from public.trade_partner_assignments a
  join public.company_memberships m
    on m.company_id=a.company_id
   and m.vendor_id=a.vendor_id
   and m.user_id=auth.uid()
   and m.status='active'
   and lower(m.role)='subcontractor'
  where a.project_id=p_project_id
    and (p_assignment_id is null or a.id=p_assignment_id)
    and a.contract_status='signed'
    and a.assignment_status='active'
  order by a.created_at desc
  limit 1;
  if not found then raise exception 'No active signed subcontract assignment is available for this project'; end if;
  if v_assignment.mobilization_status <> 'cleared' then raise exception 'Subcontractor is not cleared to mobilize'; end if;
  if coalesce(p_amount_requested,0)<=0 then raise exception 'Requested amount must be greater than zero'; end if;
  if coalesce(p_retainage_amount,0)<0 or coalesce(p_retainage_amount,0)>p_amount_requested then raise exception 'Retainage is invalid'; end if;
  if nullif(btrim(p_description),'') is null then raise exception 'Payment application description is required'; end if;

  select coalesce(v_assignment.contract_amount,0)+coalesce(sum(amount_delta) filter (where status='approved'),0)
    into v_commitment
  from public.subcontractor_change_orders
  where assignment_id=v_assignment.id;

  select coalesce(sum(amount_requested),0)
    into v_prior
  from public.subcontractor_payment_applications
  where assignment_id=v_assignment.id
    and status in ('submitted','approved','converted');

  if v_prior+p_amount_requested>v_commitment+0.01 then
    raise exception 'Payment application exceeds remaining subcontract commitment';
  end if;

  v_number:='PAY-'||upper(substr(replace(v_id::text,'-',''),1,8));
  insert into public.subcontractor_payment_applications(
    id,company_id,project_id,assignment_id,vendor_id,request_number,period_through,
    description,amount_requested,retainage_amount,status,submitted_at,submitted_by
  ) values (
    v_id,v_assignment.company_id,v_assignment.project_id,v_assignment.id,v_assignment.vendor_id,
    v_number,coalesce(p_period_through,current_date),btrim(p_description),p_amount_requested,
    coalesce(p_retainage_amount,0),'submitted',now(),auth.uid()
  );
  return v_id;
end $$;
grant execute on function public.submit_my_subcontractor_payment_application(uuid,numeric,numeric,text,date,uuid) to authenticated;

-- Never approve a negative change that would reduce the executed commitment
-- below zero or below already requested/converted subcontract billing.
create or replace function public.review_subcontractor_change_order(
  p_change_order_id uuid,
  p_action text,
  p_review_notes text default null
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.subcontractor_change_orders%rowtype;
  v_base numeric;
  v_existing_changes numeric;
  v_requested numeric;
  v_new_commitment numeric;
begin
  select * into v_row from public.subcontractor_change_orders where id=p_change_order_id for update;
  if not found then raise exception 'Subcontractor change order not found'; end if;
  if not public.has_company_role(v_row.company_id,array['owner','administrator','office_manager','project_manager']) then raise exception 'Not authorized'; end if;
  if v_row.status not in ('submitted','draft') then raise exception 'Only open subcontract change orders can be reviewed'; end if;

  if p_action='approve' then
    select coalesce(contract_amount,0) into v_base
      from public.trade_partner_assignments where id=v_row.assignment_id;
    select coalesce(sum(amount_delta),0) into v_existing_changes
      from public.subcontractor_change_orders
      where assignment_id=v_row.assignment_id and status='approved' and id<>v_row.id;
    select coalesce(sum(amount_requested),0) into v_requested
      from public.subcontractor_payment_applications
      where assignment_id=v_row.assignment_id and status in ('submitted','approved','converted');
    v_new_commitment:=v_base+v_existing_changes+v_row.amount_delta;
    if v_new_commitment<0 then raise exception 'Approved subcontract changes cannot reduce the total commitment below zero'; end if;
    if v_new_commitment+0.01<v_requested then raise exception 'Approved subcontract changes cannot reduce commitment below existing payment applications'; end if;

    update public.subcontractor_change_orders
      set status='approved',approved_at=now(),approved_by=auth.uid(),
          review_notes=nullif(btrim(p_review_notes),''),updated_by=auth.uid(),updated_at=now()
      where id=p_change_order_id;
  elsif p_action='reject' then
    update public.subcontractor_change_orders
      set status='rejected',rejected_at=now(),rejected_by=auth.uid(),
          review_notes=nullif(btrim(p_review_notes),''),updated_by=auth.uid(),updated_at=now()
      where id=p_change_order_id;
  else
    raise exception 'Action must be approve or reject';
  end if;
end $$;
grant execute on function public.review_subcontractor_change_order(uuid,text,text) to authenticated;

-- Closeout blocks every unresolved converted AP bill, not only approved bills.
create or replace function public.close_subcontractor_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_open integer;
  v_unresolved integer;
begin
  select * into v_assignment from public.trade_partner_assignments where id=p_assignment_id for update;
  if not found then raise exception 'Subcontractor assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id,array['owner','administrator','office_manager','project_manager']) then raise exception 'Not authorized'; end if;
  perform public.ensure_subcontractor_closeout_requirements(p_assignment_id);

  select count(*) into v_open
  from public.subcontractor_closeout_requirements
  where assignment_id=p_assignment_id and required and status not in ('verified','waived');
  if v_open>0 then raise exception 'Required subcontractor closeout items are still open'; end if;

  if exists(
    select 1 from public.subcontractor_payment_applications
    where assignment_id=p_assignment_id and status in ('submitted','approved')
  ) then
    raise exception 'Open subcontractor payment applications must be resolved before closeout';
  end if;

  select count(*) into v_unresolved
  from public.subcontractor_payment_applications p
  join public.vendor_bills b on b.id=p.vendor_bill_id
  where p.assignment_id=p_assignment_id
    and p.status='converted'
    and b.status not in ('paid','voided')
    and coalesce(b.balance_due,0)>0;
  if v_unresolved>0 then raise exception 'Subcontractor AP bills must be fully paid or voided before closeout'; end if;

  update public.trade_partner_assignments
    set contract_status='closed',updated_by=auth.uid(),updated_at=now()
    where id=p_assignment_id;
  update public.trade_partner_assignments
    set assignment_status='archived',updated_by=auth.uid(),updated_at=now()
    where id=p_assignment_id;
end $$;
grant execute on function public.close_subcontractor_assignment(uuid) to authenticated;

commit;

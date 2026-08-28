begin;

-- Payment applications are gross progress billings. Retainage is recorded on the
-- application and bill, but it is not currently payable. Convert only the net
-- requested amount into AP so normal bill-payment controls cannot release held
-- retainage early. A later retainage-release workflow can create the final AP
-- obligation when closeout conditions are satisfied.
create or replace function public.review_subcontractor_payment_application(
  p_application_id uuid,
  p_action text,
  p_review_notes text default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_app public.subcontractor_payment_applications%rowtype;
  v_assignment public.trade_partner_assignments%rowtype;
  v_bill_id uuid:=gen_random_uuid();
  v_bill_number text;
begin
  select * into v_app
  from public.subcontractor_payment_applications
  where id=p_application_id
  for update;

  if not found then raise exception 'Payment application not found'; end if;
  if not public.has_company_role(v_app.company_id,array['owner','administrator','office_manager','project_manager']) then
    raise exception 'Not authorized';
  end if;
  if v_app.status<>'submitted' then
    raise exception 'Only submitted payment applications can be reviewed';
  end if;

  if p_action='reject' then
    update public.subcontractor_payment_applications
      set status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),
          review_notes=nullif(btrim(p_review_notes),''),updated_at=now()
      where id=p_application_id;
    return null;
  elsif p_action<>'approve' then
    raise exception 'Action must be approve or reject';
  end if;

  select * into v_assignment
  from public.trade_partner_assignments
  where id=v_app.assignment_id;

  v_bill_number:='SUB-'||upper(substr(replace(v_bill_id::text,'-',''),1,8));

  insert into public.vendor_bills(
    id,company_id,vendor_id,project_id,bill_number,vendor_invoice_number,
    bill_date,due_date,status,subtotal_amount,tax_amount,retainage_amount,
    total_amount,amount_paid,payment_terms,memo,attachments,created_by,
    updated_by,match_status
  ) values (
    v_bill_id,v_app.company_id,v_app.vendor_id,v_app.project_id,v_bill_number,
    v_app.request_number,v_app.period_through,v_app.period_through+30,'draft',
    v_app.net_requested,0,v_app.retainage_amount,v_app.net_requested,0,
    v_assignment.payment_terms,
    'Subcontract payment application '||v_app.request_number||'. Gross requested: '||
      to_char(v_app.amount_requested,'FM999999990.00')||'. Retainage held: '||
      to_char(v_app.retainage_amount,'FM999999990.00'),
    '[]'::jsonb,auth.uid(),auth.uid(),'needs_review'
  );

  insert into public.vendor_bill_line_items(
    company_id,vendor_bill_id,project_id,description,quantity,unit_cost,
    line_amount,category,created_by,updated_by,match_status
  ) values (
    v_app.company_id,v_bill_id,v_app.project_id,v_app.description,1,
    v_app.net_requested,v_app.net_requested,'subcontractor',auth.uid(),auth.uid(),
    'needs_review'
  );

  update public.subcontractor_payment_applications
    set status='converted',vendor_bill_id=v_bill_id,reviewed_at=now(),
        reviewed_by=auth.uid(),review_notes=nullif(btrim(p_review_notes),''),updated_at=now()
    where id=p_application_id;

  return v_bill_id;
end $$;

grant execute on function public.review_subcontractor_payment_application(uuid,text,text) to authenticated;

commit;

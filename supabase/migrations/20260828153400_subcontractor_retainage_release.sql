begin;

create table if not exists public.subcontractor_retainage_releases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  assignment_id uuid not null,
  vendor_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  vendor_bill_id uuid not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (project_id,company_id) references public.projects(id,company_id) on delete cascade,
  foreign key (assignment_id,company_id) references public.trade_partner_assignments(id,company_id) on delete cascade,
  foreign key (vendor_id,company_id) references public.vendors(id,company_id) on delete cascade,
  foreign key (vendor_bill_id,company_id) references public.vendor_bills(id,company_id) on delete restrict,
  constraint subcontractor_retainage_release_assignment_unique unique (company_id,assignment_id),
  constraint subcontractor_retainage_release_bill_unique unique (company_id,vendor_bill_id)
);

create index if not exists subcontractor_retainage_releases_project_idx
  on public.subcontractor_retainage_releases(company_id,project_id,assignment_id);

alter table public.subcontractor_retainage_releases enable row level security;

create policy subcontractor_retainage_releases_internal_select on public.subcontractor_retainage_releases
  for select to authenticated
  using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));
create policy subcontractor_retainage_releases_partner_select on public.subcontractor_retainage_releases
  for select to authenticated
  using (public.is_my_trade_partner_assignment(company_id,assignment_id));
create policy subcontractor_retainage_releases_internal_insert on public.subcontractor_retainage_releases
  for insert to authenticated
  with check (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));

create or replace function public.release_subcontractor_retainage(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_open integer;
  v_open_apps integer;
  v_unresolved integer;
  v_retainage numeric;
  v_existing uuid;
  v_bill_id uuid:=gen_random_uuid();
  v_bill_number text;
begin
  select * into v_assignment
  from public.trade_partner_assignments
  where id=p_assignment_id
  for update;
  if not found then raise exception 'Subcontractor assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id,array['owner','administrator','office_manager','project_manager']) then
    raise exception 'Not authorized';
  end if;
  if v_assignment.contract_status<>'signed' then
    raise exception 'Retainage can only be released on an executed subcontract before final closeout';
  end if;

  perform public.ensure_subcontractor_closeout_requirements(p_assignment_id);
  select count(*) into v_open
  from public.subcontractor_closeout_requirements
  where assignment_id=p_assignment_id and required and status not in ('verified','waived');
  if v_open>0 then raise exception 'Required subcontractor closeout items must be completed before retainage release'; end if;

  select count(*) into v_open_apps
  from public.subcontractor_payment_applications
  where assignment_id=p_assignment_id and status in ('submitted','approved');
  if v_open_apps>0 then raise exception 'Open subcontractor payment applications must be resolved before retainage release'; end if;

  select count(*) into v_unresolved
  from public.subcontractor_payment_applications p
  join public.vendor_bills b on b.id=p.vendor_bill_id
  where p.assignment_id=p_assignment_id
    and p.status='converted'
    and b.status not in ('paid','voided')
    and coalesce(b.balance_due,0)>0;
  if v_unresolved>0 then raise exception 'Progress-payment AP bills must be fully paid or voided before retainage release'; end if;

  select coalesce(sum(retainage_amount),0) into v_retainage
  from public.subcontractor_payment_applications
  where assignment_id=p_assignment_id and status='converted';
  if v_retainage<=0 then raise exception 'No held retainage is available to release'; end if;

  select vendor_bill_id into v_existing
  from public.subcontractor_retainage_releases
  where company_id=v_assignment.company_id and assignment_id=p_assignment_id;
  if found then return v_existing; end if;

  v_bill_number:='RET-'||upper(substr(replace(v_bill_id::text,'-',''),1,8));
  insert into public.vendor_bills(
    id,company_id,vendor_id,project_id,bill_number,vendor_invoice_number,bill_date,due_date,
    status,subtotal_amount,tax_amount,retainage_amount,total_amount,amount_paid,payment_terms,
    memo,attachments,created_by,updated_by,match_status
  ) values (
    v_bill_id,v_assignment.company_id,v_assignment.vendor_id,v_assignment.project_id,v_bill_number,
    'RETAINAGE-'||upper(substr(replace(p_assignment_id::text,'-',''),1,8)),current_date,current_date+30,
    'draft',v_retainage,0,0,v_retainage,0,v_assignment.payment_terms,
    'Final subcontract retainage release. Created only after required closeout evidence and progress-payment resolution.',
    '[]'::jsonb,auth.uid(),auth.uid(),'needs_review'
  );

  insert into public.vendor_bill_line_items(
    company_id,vendor_bill_id,project_id,description,quantity,unit_cost,line_amount,category,
    created_by,updated_by,match_status
  ) values (
    v_assignment.company_id,v_bill_id,v_assignment.project_id,'Final subcontract retainage release',1,
    v_retainage,v_retainage,'subcontractor',auth.uid(),auth.uid(),'needs_review'
  );

  insert into public.subcontractor_retainage_releases(
    company_id,project_id,assignment_id,vendor_id,amount,vendor_bill_id,created_by
  ) values (
    v_assignment.company_id,v_assignment.project_id,p_assignment_id,v_assignment.vendor_id,
    v_retainage,v_bill_id,auth.uid()
  );

  return v_bill_id;
end $$;

grant execute on function public.release_subcontractor_retainage(uuid) to authenticated;

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
  v_retainage numeric;
  v_release_bill uuid;
  v_release_status text;
  v_release_balance numeric;
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

  select coalesce(sum(retainage_amount),0) into v_retainage
  from public.subcontractor_payment_applications
  where assignment_id=p_assignment_id and status='converted';

  if v_retainage>0 then
    select r.vendor_bill_id,b.status,b.balance_due
      into v_release_bill,v_release_status,v_release_balance
    from public.subcontractor_retainage_releases r
    join public.vendor_bills b on b.id=r.vendor_bill_id and b.company_id=r.company_id
    where r.company_id=v_assignment.company_id and r.assignment_id=p_assignment_id;
    if v_release_bill is null then
      raise exception 'Held retainage must be released to AP before subcontract closeout';
    end if;
    if v_release_status not in ('paid','voided') or coalesce(v_release_balance,0)>0 then
      raise exception 'Retainage AP bill must be fully paid or voided before subcontract closeout';
    end if;
  end if;

  update public.trade_partner_assignments
    set contract_status='closed',updated_by=auth.uid(),updated_at=now()
    where id=p_assignment_id;
  update public.trade_partner_assignments
    set assignment_status='archived',updated_by=auth.uid(),updated_at=now()
    where id=p_assignment_id;
end $$;

grant execute on function public.close_subcontractor_assignment(uuid) to authenticated;

commit;

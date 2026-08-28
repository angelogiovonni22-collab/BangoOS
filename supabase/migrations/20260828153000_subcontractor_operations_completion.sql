begin;

create table if not exists public.subcontractor_change_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  assignment_id uuid not null,
  vendor_id uuid not null,
  change_order_number text not null,
  title text not null,
  description text,
  amount_delta numeric(14,2) not null default 0,
  schedule_impact_days integer not null default 0,
  status text not null default 'submitted' check (status in ('draft','submitted','approved','rejected','voided')),
  submitted_at timestamptz,
  submitted_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  review_notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade,
  foreign key (assignment_id, company_id) references public.trade_partner_assignments(id, company_id) on delete cascade,
  foreign key (vendor_id, company_id) references public.vendors(id, company_id) on delete cascade,
  constraint subcontractor_change_orders_number_not_blank check (btrim(change_order_number) <> ''),
  constraint subcontractor_change_orders_title_not_blank check (btrim(title) <> ''),
  constraint subcontractor_change_orders_number_unique unique (company_id, assignment_id, change_order_number)
);

create table if not exists public.subcontractor_payment_applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  assignment_id uuid not null,
  vendor_id uuid not null,
  request_number text not null,
  period_through date not null default current_date,
  description text not null,
  amount_requested numeric(14,2) not null check (amount_requested > 0),
  retainage_amount numeric(14,2) not null default 0 check (retainage_amount >= 0),
  net_requested numeric(14,2) generated always as (greatest(amount_requested - retainage_amount, 0)) stored,
  status text not null default 'submitted' check (status in ('draft','submitted','approved','rejected','converted','voided')),
  vendor_bill_id uuid,
  submitted_at timestamptz,
  submitted_by uuid,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade,
  foreign key (assignment_id, company_id) references public.trade_partner_assignments(id, company_id) on delete cascade,
  foreign key (vendor_id, company_id) references public.vendors(id, company_id) on delete cascade,
  foreign key (vendor_bill_id, company_id) references public.vendor_bills(id, company_id) on delete set null,
  constraint subcontractor_payment_apps_number_not_blank check (btrim(request_number) <> ''),
  constraint subcontractor_payment_apps_description_not_blank check (btrim(description) <> ''),
  constraint subcontractor_payment_apps_retainage_not_over_amount check (retainage_amount <= amount_requested),
  constraint subcontractor_payment_apps_number_unique unique (company_id, assignment_id, request_number)
);

create table if not exists public.subcontractor_closeout_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  assignment_id uuid not null,
  vendor_id uuid not null,
  requirement_type text not null check (requirement_type in ('punch_complete','final_invoice','final_lien_waiver','warranty','final_certified_payroll','closeout_documents')),
  required boolean not null default true,
  status text not null default 'open' check (status in ('open','received','verified','waived')),
  evidence jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade,
  foreign key (assignment_id, company_id) references public.trade_partner_assignments(id, company_id) on delete cascade,
  foreign key (vendor_id, company_id) references public.vendors(id, company_id) on delete cascade,
  constraint subcontractor_closeout_requirement_unique unique (company_id, assignment_id, requirement_type)
);

create index if not exists subcontractor_change_orders_project_idx on public.subcontractor_change_orders(company_id,project_id,assignment_id,status);
create index if not exists subcontractor_payment_apps_project_idx on public.subcontractor_payment_applications(company_id,project_id,assignment_id,status);
create index if not exists subcontractor_closeout_project_idx on public.subcontractor_closeout_requirements(company_id,project_id,assignment_id,status);

alter table public.subcontractor_change_orders enable row level security;
alter table public.subcontractor_payment_applications enable row level security;
alter table public.subcontractor_closeout_requirements enable row level security;

create or replace function public.is_my_trade_partner_assignment(p_company_id uuid, p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.trade_partner_assignments a
    join public.company_memberships m
      on m.company_id=a.company_id
     and m.vendor_id=a.vendor_id
     and m.user_id=auth.uid()
     and m.status='active'
     and lower(m.role)='subcontractor'
    where a.id=p_assignment_id and a.company_id=p_company_id
  );
$$;
grant execute on function public.is_my_trade_partner_assignment(uuid,uuid) to authenticated;

create policy subcontractor_change_orders_internal_select on public.subcontractor_change_orders
  for select to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));
create policy subcontractor_change_orders_partner_select on public.subcontractor_change_orders
  for select to authenticated using (public.is_my_trade_partner_assignment(company_id,assignment_id));
create policy subcontractor_change_orders_internal_insert on public.subcontractor_change_orders
  for insert to authenticated with check (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));
create policy subcontractor_change_orders_internal_update on public.subcontractor_change_orders
  for update to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']))
  with check (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));

create policy subcontractor_payment_apps_internal_select on public.subcontractor_payment_applications
  for select to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));
create policy subcontractor_payment_apps_partner_select on public.subcontractor_payment_applications
  for select to authenticated using (public.is_my_trade_partner_assignment(company_id,assignment_id));
create policy subcontractor_payment_apps_internal_update on public.subcontractor_payment_applications
  for update to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']))
  with check (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));

create policy subcontractor_closeout_internal_select on public.subcontractor_closeout_requirements
  for select to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));
create policy subcontractor_closeout_partner_select on public.subcontractor_closeout_requirements
  for select to authenticated using (public.is_my_trade_partner_assignment(company_id,assignment_id));
create policy subcontractor_closeout_internal_insert on public.subcontractor_closeout_requirements
  for insert to authenticated with check (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));
create policy subcontractor_closeout_internal_update on public.subcontractor_closeout_requirements
  for update to authenticated using (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']))
  with check (public.has_company_role(company_id,array['owner','administrator','office_manager','project_manager']));

create or replace function public.ensure_subcontractor_closeout_requirements(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_prevailing boolean;
begin
  select * into v_assignment from public.trade_partner_assignments where id=p_assignment_id;
  if not found then raise exception 'Subcontractor assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id,array['owner','administrator','office_manager','project_manager'])
     and not public.is_my_trade_partner_assignment(v_assignment.company_id,p_assignment_id) then
    raise exception 'Not authorized';
  end if;
  select exists(select 1 from public.prevailing_wage_worker_assignments where company_id=v_assignment.company_id and project_id=v_assignment.project_id and trade_partner_assignment_id=p_assignment_id) into v_prevailing;
  insert into public.subcontractor_closeout_requirements(company_id,project_id,assignment_id,vendor_id,requirement_type,required)
  values
    (v_assignment.company_id,v_assignment.project_id,p_assignment_id,v_assignment.vendor_id,'punch_complete',true),
    (v_assignment.company_id,v_assignment.project_id,p_assignment_id,v_assignment.vendor_id,'final_invoice',true),
    (v_assignment.company_id,v_assignment.project_id,p_assignment_id,v_assignment.vendor_id,'final_lien_waiver',true),
    (v_assignment.company_id,v_assignment.project_id,p_assignment_id,v_assignment.vendor_id,'warranty',true),
    (v_assignment.company_id,v_assignment.project_id,p_assignment_id,v_assignment.vendor_id,'final_certified_payroll',v_prevailing),
    (v_assignment.company_id,v_assignment.project_id,p_assignment_id,v_assignment.vendor_id,'closeout_documents',true)
  on conflict (company_id,assignment_id,requirement_type) do update set required=excluded.required,updated_at=now();
end $$;
grant execute on function public.ensure_subcontractor_closeout_requirements(uuid) to authenticated;

create or replace function public.create_subcontractor_change_order(
  p_assignment_id uuid,
  p_title text,
  p_description text default null,
  p_amount_delta numeric default 0,
  p_schedule_impact_days integer default 0
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_id uuid:=gen_random_uuid();
  v_number text;
begin
  select * into v_assignment from public.trade_partner_assignments where id=p_assignment_id;
  if not found then raise exception 'Subcontractor assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id,array['owner','administrator','office_manager','project_manager']) then raise exception 'Not authorized'; end if;
  if v_assignment.contract_status not in ('signed','closed') then raise exception 'Subcontract change orders require an executed subcontract'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'Title is required'; end if;
  v_number:='SCO-'||upper(substr(replace(v_id::text,'-',''),1,8));
  insert into public.subcontractor_change_orders(id,company_id,project_id,assignment_id,vendor_id,change_order_number,title,description,amount_delta,schedule_impact_days,status,submitted_at,submitted_by,created_by,updated_by)
  values(v_id,v_assignment.company_id,v_assignment.project_id,v_assignment.id,v_assignment.vendor_id,v_number,btrim(p_title),nullif(btrim(p_description),''),coalesce(p_amount_delta,0),coalesce(p_schedule_impact_days,0),'submitted',now(),auth.uid(),auth.uid(),auth.uid());
  return v_id;
end $$;
grant execute on function public.create_subcontractor_change_order(uuid,text,text,numeric,integer) to authenticated;

create or replace function public.review_subcontractor_change_order(p_change_order_id uuid,p_action text,p_review_notes text default null)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.subcontractor_change_orders%rowtype;
begin
  select * into v_row from public.subcontractor_change_orders where id=p_change_order_id for update;
  if not found then raise exception 'Subcontractor change order not found'; end if;
  if not public.has_company_role(v_row.company_id,array['owner','administrator','office_manager','project_manager']) then raise exception 'Not authorized'; end if;
  if v_row.status not in ('submitted','draft') then raise exception 'Only open subcontract change orders can be reviewed'; end if;
  if p_action='approve' then
    update public.subcontractor_change_orders set status='approved',approved_at=now(),approved_by=auth.uid(),review_notes=nullif(btrim(p_review_notes),''),updated_by=auth.uid(),updated_at=now() where id=p_change_order_id;
  elsif p_action='reject' then
    update public.subcontractor_change_orders set status='rejected',rejected_at=now(),rejected_by=auth.uid(),review_notes=nullif(btrim(p_review_notes),''),updated_by=auth.uid(),updated_at=now() where id=p_change_order_id;
  else raise exception 'Action must be approve or reject';
  end if;
end $$;
grant execute on function public.review_subcontractor_change_order(uuid,text,text) to authenticated;

create or replace function public.submit_my_subcontractor_payment_application(
  p_project_id uuid,
  p_amount_requested numeric,
  p_retainage_amount numeric default 0,
  p_description text default null,
  p_period_through date default current_date
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
  join public.company_memberships m on m.company_id=a.company_id and m.vendor_id=a.vendor_id and m.user_id=auth.uid() and m.status='active' and lower(m.role)='subcontractor'
  where a.project_id=p_project_id and a.contract_status='signed' and a.assignment_status='active'
  order by a.created_at desc limit 1;
  if not found then raise exception 'No active signed subcontract assignment is available for this project'; end if;
  if v_assignment.mobilization_status <> 'cleared' then raise exception 'Subcontractor is not cleared to mobilize'; end if;
  if coalesce(p_amount_requested,0)<=0 then raise exception 'Requested amount must be greater than zero'; end if;
  if coalesce(p_retainage_amount,0)<0 or coalesce(p_retainage_amount,0)>p_amount_requested then raise exception 'Retainage is invalid'; end if;
  if nullif(btrim(p_description),'') is null then raise exception 'Payment application description is required'; end if;
  select coalesce(v_assignment.contract_amount,0)+coalesce(sum(amount_delta) filter (where status='approved'),0)
    into v_commitment from public.subcontractor_change_orders where assignment_id=v_assignment.id;
  select coalesce(sum(amount_requested),0) into v_prior from public.subcontractor_payment_applications
    where assignment_id=v_assignment.id and status in ('submitted','approved','converted');
  if v_prior+p_amount_requested>v_commitment+0.01 then raise exception 'Payment application exceeds remaining subcontract commitment'; end if;
  v_number:='PAY-'||upper(substr(replace(v_id::text,'-',''),1,8));
  insert into public.subcontractor_payment_applications(id,company_id,project_id,assignment_id,vendor_id,request_number,period_through,description,amount_requested,retainage_amount,status,submitted_at,submitted_by)
  values(v_id,v_assignment.company_id,v_assignment.project_id,v_assignment.id,v_assignment.vendor_id,v_number,coalesce(p_period_through,current_date),btrim(p_description),p_amount_requested,coalesce(p_retainage_amount,0),'submitted',now(),auth.uid());
  return v_id;
end $$;
grant execute on function public.submit_my_subcontractor_payment_application(uuid,numeric,numeric,text,date) to authenticated;

create or replace function public.review_subcontractor_payment_application(p_application_id uuid,p_action text,p_review_notes text default null)
returns uuid
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
  select * into v_app from public.subcontractor_payment_applications where id=p_application_id for update;
  if not found then raise exception 'Payment application not found'; end if;
  if not public.has_company_role(v_app.company_id,array['owner','administrator','office_manager','project_manager']) then raise exception 'Not authorized'; end if;
  if v_app.status<>'submitted' then raise exception 'Only submitted payment applications can be reviewed'; end if;
  if p_action='reject' then
    update public.subcontractor_payment_applications set status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),review_notes=nullif(btrim(p_review_notes),''),updated_at=now() where id=p_application_id;
    return null;
  elsif p_action<>'approve' then raise exception 'Action must be approve or reject'; end if;
  select * into v_assignment from public.trade_partner_assignments where id=v_app.assignment_id;
  v_bill_number:='SUB-'||upper(substr(replace(v_bill_id::text,'-',''),1,8));
  insert into public.vendor_bills(id,company_id,vendor_id,project_id,bill_number,vendor_invoice_number,bill_date,due_date,status,subtotal_amount,tax_amount,retainage_amount,total_amount,amount_paid,payment_terms,memo,attachments,created_by,updated_by,match_status)
  values(v_bill_id,v_app.company_id,v_app.vendor_id,v_app.project_id,v_bill_number,v_app.request_number,v_app.period_through,v_app.period_through+30,'draft',v_app.amount_requested,0,v_app.retainage_amount,v_app.amount_requested,0,v_assignment.payment_terms,'Subcontract payment application '||v_app.request_number||'. Retainage held: '||to_char(v_app.retainage_amount,'FM999999990.00'),'[]'::jsonb,auth.uid(),auth.uid(),'needs_review');
  insert into public.vendor_bill_line_items(company_id,vendor_bill_id,project_id,description,quantity,unit_cost,line_amount,category,created_by,updated_by,match_status)
  values(v_app.company_id,v_bill_id,v_app.project_id,v_app.description,1,v_app.amount_requested,v_app.amount_requested,'subcontractor',auth.uid(),auth.uid(),'needs_review');
  update public.subcontractor_payment_applications set status='converted',vendor_bill_id=v_bill_id,reviewed_at=now(),reviewed_by=auth.uid(),review_notes=nullif(btrim(p_review_notes),''),updated_at=now() where id=p_application_id;
  return v_bill_id;
end $$;
grant execute on function public.review_subcontractor_payment_application(uuid,text,text) to authenticated;

create or replace function public.update_subcontractor_closeout_requirement(p_requirement_id uuid,p_status text,p_evidence jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.subcontractor_closeout_requirements%rowtype;
begin
  select * into v_row from public.subcontractor_closeout_requirements where id=p_requirement_id for update;
  if not found then raise exception 'Closeout requirement not found'; end if;
  if not public.has_company_role(v_row.company_id,array['owner','administrator','office_manager','project_manager']) then raise exception 'Not authorized'; end if;
  if p_status not in ('open','received','verified','waived') then raise exception 'Invalid closeout status'; end if;
  update public.subcontractor_closeout_requirements set status=p_status,evidence=coalesce(p_evidence,evidence),verified_at=case when p_status in ('verified','waived') then now() else null end,verified_by=case when p_status in ('verified','waived') then auth.uid() else null end,updated_at=now() where id=p_requirement_id;
end $$;
grant execute on function public.update_subcontractor_closeout_requirement(uuid,text,jsonb) to authenticated;

create or replace function public.close_subcontractor_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_assignment public.trade_partner_assignments%rowtype; v_open integer; v_unpaid integer;
begin
  select * into v_assignment from public.trade_partner_assignments where id=p_assignment_id for update;
  if not found then raise exception 'Subcontractor assignment not found'; end if;
  if not public.has_company_role(v_assignment.company_id,array['owner','administrator','office_manager','project_manager']) then raise exception 'Not authorized'; end if;
  perform public.ensure_subcontractor_closeout_requirements(p_assignment_id);
  select count(*) into v_open from public.subcontractor_closeout_requirements where assignment_id=p_assignment_id and required and status not in ('verified','waived');
  if v_open>0 then raise exception 'Required subcontractor closeout items are still open'; end if;
  if exists(select 1 from public.subcontractor_payment_applications where assignment_id=p_assignment_id and status in ('submitted','approved')) then raise exception 'Open subcontractor payment applications must be resolved before closeout'; end if;
  select count(*) into v_unpaid from public.subcontractor_payment_applications p join public.vendor_bills b on b.id=p.vendor_bill_id where p.assignment_id=p_assignment_id and p.status='converted' and b.status in ('approved','partially_paid') and coalesce(b.balance_due,0)>0;
  if v_unpaid>0 then raise exception 'Approved subcontractor bills must be fully paid or resolved before closeout'; end if;
  update public.trade_partner_assignments set contract_status='closed',updated_by=auth.uid(),updated_at=now() where id=p_assignment_id;
  update public.trade_partner_assignments set assignment_status='archived',updated_by=auth.uid(),updated_at=now() where id=p_assignment_id;
end $$;
grant execute on function public.close_subcontractor_assignment(uuid) to authenticated;

create or replace function public.protect_signed_subcontract_archive()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.contract_status='signed' and new.assignment_status='archived' and new.contract_status<>'closed' then
    raise exception 'Signed subcontractors must complete closeout before archiving.';
  end if;
  return new;
end $$;
drop trigger if exists trade_partner_assignment_closeout_guard on public.trade_partner_assignments;
create trigger trade_partner_assignment_closeout_guard
before update of assignment_status,contract_status on public.trade_partner_assignments
for each row execute function public.protect_signed_subcontract_archive();

create or replace function public.seed_subcontractor_closeout_on_activation()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.contract_status='signed' and new.mobilization_status='cleared' then
    insert into public.subcontractor_closeout_requirements(company_id,project_id,assignment_id,vendor_id,requirement_type,required)
    values
      (new.company_id,new.project_id,new.id,new.vendor_id,'punch_complete',true),
      (new.company_id,new.project_id,new.id,new.vendor_id,'final_invoice',true),
      (new.company_id,new.project_id,new.id,new.vendor_id,'final_lien_waiver',true),
      (new.company_id,new.project_id,new.id,new.vendor_id,'warranty',true),
      (new.company_id,new.project_id,new.id,new.vendor_id,'final_certified_payroll',exists(select 1 from public.prevailing_wage_worker_assignments where company_id=new.company_id and project_id=new.project_id and trade_partner_assignment_id=new.id)),
      (new.company_id,new.project_id,new.id,new.vendor_id,'closeout_documents',true)
    on conflict (company_id,assignment_id,requirement_type) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trade_partner_assignment_closeout_seed on public.trade_partner_assignments;
create trigger trade_partner_assignment_closeout_seed
after insert or update of contract_status,mobilization_status on public.trade_partner_assignments
for each row execute function public.seed_subcontractor_closeout_on_activation();

insert into public.subcontractor_closeout_requirements(company_id,project_id,assignment_id,vendor_id,requirement_type,required)
select a.company_id,a.project_id,a.id,a.vendor_id,x.requirement_type,
  case when x.requirement_type='final_certified_payroll' then exists(select 1 from public.prevailing_wage_worker_assignments p where p.company_id=a.company_id and p.project_id=a.project_id and p.trade_partner_assignment_id=a.id) else true end
from public.trade_partner_assignments a
cross join (values ('punch_complete'),('final_invoice'),('final_lien_waiver'),('warranty'),('final_certified_payroll'),('closeout_documents')) x(requirement_type)
where a.contract_status in ('signed','closed')
on conflict (company_id,assignment_id,requirement_type) do nothing;

commit;
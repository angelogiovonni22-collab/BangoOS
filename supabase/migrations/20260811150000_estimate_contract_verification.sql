begin;

alter table public.estimate_acceptance_events drop constraint if exists estimate_acceptance_events_event_type_check;
alter table public.estimate_acceptance_events add constraint estimate_acceptance_events_event_type_check check (event_type in ('approved','declined','request_changes','sent','viewed','followup_due','signed','verified','converted'));

create table public.estimate_contract_verifications (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null, signature_id uuid not null, token_hash text not null unique, email text not null,
  status text not null default 'pending' check (status in ('pending','verified','expired','manual_review')),
  delivery_status text not null default 'queued' check (delivery_status in ('queued','delivered','failed')),
  provider_message_id text, delivery_error text, expires_at timestamptz not null, verified_at timestamptz,
  project_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(signature_id), foreign key (estimate_id, company_id) references public.estimates(id, company_id) on delete cascade,
  foreign key (signature_id, company_id) references public.estimate_signatures(id, company_id) on delete cascade,
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete set null
);
alter table public.estimate_contract_verifications enable row level security;
create policy estimate_contract_verifications_select on public.estimate_contract_verifications for select to authenticated using (public.is_company_member(company_id));

create or replace function public.convert_verified_estimate_contract(p_company_id uuid, p_estimate_id uuid, p_signature_id uuid, p_actor_profile_id uuid)
returns table(project_id uuid, project_number text, idempotent boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_est public.estimates%rowtype; v_customer public.customers%rowtype; v_existing uuid; v_project uuid; v_number text; v_conversion uuid;
begin
  if not exists(select 1 from public.estimate_signatures s where s.id=p_signature_id and s.company_id=p_company_id and s.estimate_id=p_estimate_id and s.verification_result='verified') then raise exception 'Verified signature required'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_actor_profile_id and p.company_id=p_company_id) then raise exception 'Company actor required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estimate_id::text, 0));
  select converted_project_id into v_existing from public.estimates where id=p_estimate_id and company_id=p_company_id;
  if v_existing is not null then select project_number into v_number from public.projects where id=v_existing; return query select v_existing,v_number,true; return; end if;
  select * into v_est from public.estimates where id=p_estimate_id and company_id=p_company_id for update;
  if not found or v_est.status <> 'approved' then raise exception 'Approved estimate required'; end if;
  select * into v_customer from public.customers where id=v_est.customer_id and company_id=p_company_id;
  v_number := public.allocate_project_number(p_company_id);
  insert into public.projects(company_id,customer_id,name,project_number,status,description,contract_amount,estimated_cost,created_by,address_line_1,address_line_2,city,state,postal_code,primary_contact_name,primary_contact_phone,primary_contact_email)
  values(p_company_id,v_est.customer_id,coalesce(nullif(btrim(v_est.title),''),'Converted Project'),v_number,'approved',v_est.description,v_est.total_amount,v_est.direct_cost_subtotal,p_actor_profile_id,v_customer.address_line_1,v_customer.address_line_2,v_customer.city,v_customer.state,v_customer.postal_code,concat_ws(' ',v_customer.first_name,v_customer.last_name),v_customer.phone,v_customer.email)
  returning id into v_project;
  insert into public.estimate_project_conversions(company_id,estimate_id,project_id,idempotency_key,status,converted_by,metadata,completed_at)
  values(p_company_id,p_estimate_id,v_project,'verified-contract:'||p_signature_id,'completed',p_actor_profile_id,jsonb_build_object('source','verified_contract','signature_id',p_signature_id),now()) returning id into v_conversion;
  update public.estimates set project_id=v_project,conversion_state='converted',converted_project_id=v_project,converted_at=now(),updated_by=p_actor_profile_id where id=p_estimate_id and company_id=p_company_id;
  insert into public.estimate_acceptance_events(company_id,estimate_id,signature_id,event_type,actor_type,actor_profile_id,idempotency_key,metadata) values(p_company_id,p_estimate_id,p_signature_id,'verified','system',p_actor_profile_id,'verified:'||p_signature_id,jsonb_build_object('verification','email'));
  insert into public.estimate_acceptance_events(company_id,estimate_id,signature_id,event_type,actor_type,actor_profile_id,idempotency_key,metadata) values(p_company_id,p_estimate_id,p_signature_id,'converted','system',p_actor_profile_id,'verified-contract:'||p_signature_id,jsonb_build_object('project_id',v_project,'conversion_id',v_conversion));
  insert into public.workflow_events(company_id,workflow_name,event_type,current_state,next_state,actor_profile_id,reference_entity,reference_id,metadata) values
    (p_company_id,'estimate_lifecycle','contract.verified','signed','verified',p_actor_profile_id,'estimate',p_estimate_id,jsonb_build_object('signature_id',p_signature_id)),
    (p_company_id,'estimate_lifecycle','estimate.converted','approved','converted',p_actor_profile_id,'estimate',p_estimate_id,jsonb_build_object('project_id',v_project,'conversion_id',v_conversion)),
    (p_company_id,'project_lifecycle','project.created',null,'approved',p_actor_profile_id,'project',v_project,jsonb_build_object('estimate_id',p_estimate_id,'signature_id',p_signature_id));
  return query select v_project,v_number,false;
end; $$;
revoke all on function public.convert_verified_estimate_contract(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.convert_verified_estimate_contract(uuid,uuid,uuid,uuid) to service_role;

commit;

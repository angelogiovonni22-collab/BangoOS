create or replace function public.convert_verified_estimate_contract(
  p_company_id uuid,
  p_estimate_id uuid,
  p_signature_id uuid,
  p_actor_profile_id uuid
)
returns table(project_id uuid, project_number text, idempotent boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_est public.estimates%rowtype;
  v_customer public.customers%rowtype;
  v_prospect public.estimate_prospects%rowtype;
  v_customer_id uuid;
  v_existing uuid;
  v_project uuid;
  v_number text;
  v_conversion uuid;
  v_email text;
  v_phone_digits text;
begin
  if not exists (
    select 1 from public.estimate_signatures s
    where s.id = p_signature_id
      and s.company_id = p_company_id
      and s.estimate_id = p_estimate_id
      and s.verification_result = 'verified'
  ) then raise exception 'Verified signature required'; end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_profile_id and p.company_id = p_company_id
  ) then raise exception 'Company actor required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_estimate_id::text, 0));

  select converted_project_id into v_existing
  from public.estimates
  where id = p_estimate_id and company_id = p_company_id;

  if v_existing is not null then
    select p.project_number into v_number
    from public.projects p
    where p.id = v_existing and p.company_id = p_company_id;
    return query select v_existing, v_number, true;
    return;
  end if;

  select * into v_est
  from public.estimates
  where id = p_estimate_id and company_id = p_company_id
  for update;

  if not found or v_est.status <> 'approved' then
    raise exception 'Approved estimate required';
  end if;

  v_customer_id := v_est.customer_id;
  if v_customer_id is null then
    select * into v_prospect
    from public.estimate_prospects
    where company_id = p_company_id and estimate_id = p_estimate_id
    for update;

    if not found then raise exception 'Prospect details are required before converting this estimate'; end if;

    v_email := lower(btrim(v_prospect.email));
    v_phone_digits := regexp_replace(coalesce(v_prospect.phone, ''), '[^0-9]', '', 'g');

    select c.id into v_customer_id
    from public.customers c
    where c.company_id = p_company_id
      and lower(btrim(coalesce(c.email, ''))) = v_email
    order by c.created_at asc
    limit 1;

    if v_customer_id is null and length(v_phone_digits) >= 7 then
      select c.id into v_customer_id
      from public.customers c
      where c.company_id = p_company_id
        and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = v_phone_digits
      order by c.created_at asc
      limit 1;
    end if;

    if v_customer_id is null and btrim(coalesce(v_prospect.company_name, '')) <> '' then
      select c.id into v_customer_id
      from public.customers c
      where c.company_id = p_company_id
        and lower(btrim(coalesce(c.company_name, ''))) = lower(btrim(v_prospect.company_name))
        and lower(btrim(coalesce(c.first_name, ''))) = lower(btrim(v_prospect.first_name))
        and lower(btrim(coalesce(c.last_name, ''))) = lower(btrim(v_prospect.last_name))
      order by c.created_at asc
      limit 1;
    end if;

    if v_customer_id is null then
      insert into public.customers(
        company_id, customer_type, first_name, last_name, company_name,
        email, phone, address_line_1, address_line_2, city, state,
        postal_code, notes, status, created_by
      ) values (
        p_company_id, v_prospect.customer_type, btrim(v_prospect.first_name), btrim(v_prospect.last_name),
        nullif(btrim(coalesce(v_prospect.company_name, '')), ''), btrim(v_prospect.email), btrim(v_prospect.phone),
        btrim(v_prospect.address_line_1), nullif(btrim(coalesce(v_prospect.address_line_2, '')), ''),
        btrim(v_prospect.city), btrim(v_prospect.state), btrim(v_prospect.postal_code),
        nullif(btrim(coalesce(v_prospect.notes, '')), ''), 'active', p_actor_profile_id
      ) returning id into v_customer_id;
    end if;

    update public.estimates
    set customer_id = v_customer_id, updated_by = p_actor_profile_id
    where id = p_estimate_id and company_id = p_company_id;
  end if;

  select * into v_customer
  from public.customers
  where id = v_customer_id and company_id = p_company_id;
  if not found then raise exception 'Resolved customer not found'; end if;

  v_number := public.allocate_project_number_for_actor(p_company_id, p_actor_profile_id);

  insert into public.projects(
    company_id, customer_id, name, project_number, status, description,
    contract_amount, estimated_cost, created_by, address_line_1, address_line_2,
    city, state, postal_code, primary_contact_name, primary_contact_phone, primary_contact_email
  ) values (
    p_company_id, v_customer_id, coalesce(nullif(btrim(v_est.title), ''), 'Converted Project'),
    v_number, 'approved', v_est.description, v_est.total_amount, v_est.direct_cost_subtotal,
    p_actor_profile_id, v_customer.address_line_1, v_customer.address_line_2,
    v_customer.city, v_customer.state, v_customer.postal_code,
    concat_ws(' ', v_customer.first_name, v_customer.last_name), v_customer.phone, v_customer.email
  ) returning id into v_project;

  insert into public.estimate_project_conversions(
    company_id, estimate_id, project_id, idempotency_key, status, converted_by, metadata, completed_at
  ) values (
    p_company_id, p_estimate_id, v_project, 'verified-contract:' || p_signature_id,
    'completed', p_actor_profile_id,
    jsonb_build_object('source', 'verified_contract', 'signature_id', p_signature_id, 'customer_id', v_customer_id), now()
  ) returning id into v_conversion;

  update public.estimates
  set project_id = v_project,
      customer_id = v_customer_id,
      conversion_state = 'converted',
      converted_project_id = v_project,
      converted_at = now(),
      updated_by = p_actor_profile_id
  where id = p_estimate_id and company_id = p_company_id;

  insert into public.estimate_acceptance_events(
    company_id, estimate_id, signature_id, event_type, actor_type, actor_profile_id, idempotency_key, metadata
  )
  select p_company_id, p_estimate_id, p_signature_id, 'verified', 'system', p_actor_profile_id,
         'verified:' || p_signature_id,
         jsonb_build_object('verification', 'secure_contract_link', 'customer_id', v_customer_id)
  where not exists (
    select 1 from public.estimate_acceptance_events e
    where e.company_id = p_company_id
      and e.estimate_id = p_estimate_id
      and e.idempotency_key = 'verified:' || p_signature_id
  );

  insert into public.estimate_acceptance_events(
    company_id, estimate_id, signature_id, event_type, actor_type, actor_profile_id, idempotency_key, metadata
  )
  select p_company_id, p_estimate_id, p_signature_id, 'converted', 'system', p_actor_profile_id,
         'verified-contract:' || p_signature_id,
         jsonb_build_object('project_id', v_project, 'customer_id', v_customer_id, 'conversion_id', v_conversion)
  where not exists (
    select 1 from public.estimate_acceptance_events e
    where e.company_id = p_company_id
      and e.estimate_id = p_estimate_id
      and e.idempotency_key = 'verified-contract:' || p_signature_id
  );

  insert into public.workflow_events(
    company_id, workflow_name, event_type, current_state, next_state,
    actor_profile_id, reference_entity, reference_id, metadata
  ) values
    (p_company_id, 'estimate_lifecycle', 'contract.verified', 'signed', 'verified', p_actor_profile_id, 'estimate', p_estimate_id, jsonb_build_object('signature_id', p_signature_id, 'customer_id', v_customer_id)),
    (p_company_id, 'estimate_lifecycle', 'estimate.converted', 'approved', 'converted', p_actor_profile_id, 'estimate', p_estimate_id, jsonb_build_object('project_id', v_project, 'customer_id', v_customer_id, 'conversion_id', v_conversion)),
    (p_company_id, 'project_lifecycle', 'project.created', null, 'approved', p_actor_profile_id, 'project', v_project, jsonb_build_object('estimate_id', p_estimate_id, 'signature_id', p_signature_id, 'customer_id', v_customer_id));

  return query select v_project, v_number, false;
end;
$$;

revoke all on function public.convert_verified_estimate_contract(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.convert_verified_estimate_contract(uuid, uuid, uuid, uuid) to service_role;

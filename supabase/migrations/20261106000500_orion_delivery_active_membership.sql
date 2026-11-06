-- Revoke client delivery access when company membership becomes inactive.
-- Retain existing profile-company, server-subscriber and service-role boundaries.
CREATE OR REPLACE FUNCTION public.claim_orion_event_delivery(p_company_id uuid, p_event_id uuid, p_subscriber_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_lease_expires_at timestamptz;
  v_is_service_role boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
begin
  if not v_is_service_role and btrim(p_subscriber_key) like 'server:%' then
    raise exception 'Server-managed Orion delivery';
  end if;

  if p_company_id is null or p_event_id is null or nullif(btrim(p_subscriber_key), '') is null then
    raise exception 'Invalid Orion delivery claim';
  end if;

  if not v_is_service_role
     and (not public.is_company_member(p_company_id, (select auth.uid()))
          or not exists (
       select 1
       from public.profiles p
       where p.id = (select auth.uid())
         and p.company_id = p_company_id
     )) then
    raise exception 'Unauthorized Orion delivery access';
  end if;

  if not exists (
    select 1
    from public.workflow_events e
    where e.id = p_event_id
      and e.company_id = p_company_id
  ) then
    raise exception 'Orion event not found for company';
  end if;

  insert into public.orion_event_deliveries (
    company_id,
    event_id,
    subscriber_key,
    status,
    updated_at
  ) values (
    p_company_id,
    p_event_id,
    btrim(p_subscriber_key),
    'pending',
    now()
  )
  on conflict (company_id, event_id, subscriber_key) do nothing;

  select d.status, d.lease_expires_at
    into v_status, v_lease_expires_at
  from public.orion_event_deliveries d
  where d.company_id = p_company_id
    and d.event_id = p_event_id
    and d.subscriber_key = btrim(p_subscriber_key)
  for update;

  if v_status = 'delivered' then
    return 'delivered';
  end if;

  if v_status = 'processing' and v_lease_expires_at is not null and v_lease_expires_at > now() then
    return 'leased';
  end if;

  update public.orion_event_deliveries d
  set status = 'processing',
      attempt_count = d.attempt_count + 1,
      last_attempt_at = now(),
      lease_expires_at = now() + interval '90 seconds',
      last_error = null,
      updated_at = now()
  where d.company_id = p_company_id
    and d.event_id = p_event_id
    and d.subscriber_key = btrim(p_subscriber_key);

  return 'claimed';
end;
$function$;

-- Derived mobilization refresh keeps its internal/service context but revokes inactive clients.
CREATE OR REPLACE FUNCTION public.refresh_subcontractor_mobilization_status(p_company_id uuid, p_assignment_id uuid)
 RETURNS TABLE(mobilization_status text, blockers jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_blockers jsonb;
  v_status text;
begin
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and (not public.is_company_member(p_company_id, (select auth.uid()))
          or not exists (
       select 1 from public.profiles
       where id = auth.uid() and company_id = p_company_id
     )) then
    raise exception 'Unauthorized subcontractor mobilization access';
  end if;

  if not exists (
    select 1 from public.trade_partner_assignments
    where id = p_assignment_id and company_id = p_company_id
  ) then
    raise exception 'Subcontractor assignment not found';
  end if;

  select coalesce(jsonb_agg(requirement_type order by requirement_type), '[]'::jsonb)
    into v_blockers
  from public.subcontractor_mobilization_requirements
  where company_id = p_company_id
    and assignment_id = p_assignment_id
    and required = true
    and status not in ('verified','waived');

  v_status := case when jsonb_array_length(v_blockers) = 0 then 'cleared' else 'not_cleared' end;

  update public.trade_partner_assignments
     set mobilization_status = v_status,
         mobilization_blockers = v_blockers,
         mobilization_cleared_at = case when v_status = 'cleared' then coalesce(mobilization_cleared_at, now()) else null end,
         updated_at = now()
   where id = p_assignment_id and company_id = p_company_id;

  return query select v_status, v_blockers;
end;
$function$;


CREATE OR REPLACE FUNCTION public.complete_orion_event_delivery(p_company_id uuid, p_event_id uuid, p_subscriber_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_service_role boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
begin
  if not v_is_service_role and btrim(p_subscriber_key) like 'server:%' then
    raise exception 'Server-managed Orion delivery';
  end if;

  if not v_is_service_role
     and (not public.is_company_member(p_company_id, (select auth.uid()))
          or not exists (
       select 1
       from public.profiles p
       where p.id = (select auth.uid())
         and p.company_id = p_company_id
     )) then
    raise exception 'Unauthorized Orion delivery access';
  end if;

  update public.orion_event_deliveries d
  set status = 'delivered',
      delivered_at = coalesce(d.delivered_at, now()),
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
  where d.company_id = p_company_id
    and d.event_id = p_event_id
    and d.subscriber_key = btrim(p_subscriber_key)
    and d.status = 'processing';

  if not found then
    raise exception 'Orion delivery is not currently claimed';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fail_orion_event_delivery(p_company_id uuid, p_event_id uuid, p_subscriber_key text, p_error text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_service_role boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
begin
  if not v_is_service_role and btrim(p_subscriber_key) like 'server:%' then
    raise exception 'Server-managed Orion delivery';
  end if;

  if not v_is_service_role
     and (not public.is_company_member(p_company_id, (select auth.uid()))
          or not exists (
       select 1
       from public.profiles p
       where p.id = (select auth.uid())
         and p.company_id = p_company_id
     )) then
    raise exception 'Unauthorized Orion delivery access';
  end if;

  update public.orion_event_deliveries d
  set status = 'failed',
      lease_expires_at = null,
      last_error = left(coalesce(p_error, 'Subscriber failed'), 4000),
      updated_at = now()
  where d.company_id = p_company_id
    and d.event_id = p_event_id
    and d.subscriber_key = btrim(p_subscriber_key)
    and d.status = 'processing';

  if not found then
    raise exception 'Orion delivery is not currently claimed';
  end if;
end;
$function$;



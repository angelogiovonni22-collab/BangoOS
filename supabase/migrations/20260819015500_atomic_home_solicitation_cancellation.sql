begin;

-- A cancellation notice touches legal evidence, the compliance profile, the
-- governing estimate, and possibly the converted project. Keep that transition in
-- one database transaction so a network/process failure cannot leave partial legal
-- state. The public route validates the bearer token first; this RPC independently
-- revalidates that token under the same legal-action lock used by signature
-- finalization so an old/revoked link cannot win a race after route validation.
create or replace function public.record_verified_home_solicitation_cancellation(
  p_company_id uuid,
  p_estimate_id uuid,
  p_public_token_id uuid,
  p_received_at timestamptz,
  p_effective_date date,
  p_notice_text text,
  p_ip_address text default null,
  p_user_agent text default null
)
returns table(
  cancelled boolean,
  timely boolean,
  already_recorded boolean,
  received_at timestamptz,
  deadline_date date,
  project_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.estimate_home_solicitation_profiles%rowtype;
  v_token public.estimate_public_tokens%rowtype;
  v_project_id uuid;
  v_received_at timestamptz := coalesce(p_received_at, now());
  v_effective_date date := p_effective_date;
  v_timely boolean;
  v_notice text := btrim(coalesce(p_notice_text, ''));
  v_existing_received_at timestamptz;
  v_existing_deadline date;
  v_existing_timely boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  if p_company_id is null or p_estimate_id is null or p_public_token_id is null or v_effective_date is null then
    raise exception 'Cancellation identity, bearer token, and effective date are required.' using errcode = '22023';
  end if;
  if char_length(v_notice) not between 1 and 4000 then
    raise exception 'Cancellation notice must contain between 1 and 4000 characters.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('home-solicitation-cancel:' || p_estimate_id::text, 0));

  select * into v_token
  from public.estimate_public_tokens t
  where t.id = p_public_token_id
    and t.company_id = p_company_id
    and t.estimate_id = p_estimate_id
  for update;

  if not found or v_token.revoked_at is not null or v_token.expires_at <= v_received_at then
    raise exception 'CONTRACT_TOKEN_NO_LONGER_VALID' using errcode = '42501';
  end if;

  select * into v_profile
  from public.estimate_home_solicitation_profiles p
  where p.company_id = p_company_id
    and p.estimate_id = p_estimate_id
  for update;

  if not found then
    raise exception 'Home-solicitation profile not found.' using errcode = 'P0002';
  end if;
  if v_profile.transaction_signed_at is null or v_profile.cancellation_deadline_date is null then
    raise exception 'The signed transaction record is not complete.' using errcode = '23514';
  end if;

  select coalesce(e.converted_project_id, e.project_id) into v_project_id
  from public.estimates e
  where e.company_id = p_company_id
    and e.id = p_estimate_id
  for update;

  if not found then
    raise exception 'Estimate not found.' using errcode = 'P0002';
  end if;

  if v_profile.cancelled_at is not null then
    return query select true, true, true, v_profile.cancelled_at, v_profile.cancellation_deadline_date, v_project_id;
    return;
  end if;

  -- Network retries/double submissions must not create duplicate legal notices.
  -- A timely cancellation is handled by cancelled_at above; this branch primarily
  -- makes late review requests idempotent as well.
  select c.received_at, c.deadline_date, coalesce(c.timely, false)
    into v_existing_received_at, v_existing_deadline, v_existing_timely
  from public.estimate_home_solicitation_cancellations c
  where c.company_id = p_company_id
    and c.estimate_id = p_estimate_id
    and c.public_token_id = p_public_token_id
    and c.effective_date = v_effective_date
    and c.notice_text = v_notice
  order by c.received_at asc
  limit 1;

  if found then
    return query select false, v_existing_timely, true, v_existing_received_at, coalesce(v_existing_deadline, v_profile.cancellation_deadline_date), v_project_id;
    return;
  end if;

  v_timely := v_effective_date <= v_profile.cancellation_deadline_date;

  insert into public.estimate_home_solicitation_cancellations(
    company_id, estimate_id, public_token_id, received_at, effective_date,
    deadline_date, timely, notice_text, ip_address, user_agent, metadata
  ) values (
    p_company_id, p_estimate_id, p_public_token_id, v_received_at, v_effective_date,
    v_profile.cancellation_deadline_date, v_timely, v_notice,
    nullif(left(btrim(coalesce(p_ip_address, '')), 256), ''),
    nullif(left(btrim(coalesce(p_user_agent, '')), 1000), ''),
    jsonb_build_object('channel', 'bos_secure_contract_link')
  );

  insert into public.estimate_home_solicitation_events(
    company_id, estimate_id, event_type, occurred_at, actor_type, metadata
  ) values (
    p_company_id, p_estimate_id, 'cancellation_received', v_received_at, 'customer',
    jsonb_build_object(
      'receivedAt', v_received_at,
      'effectiveDate', v_effective_date,
      'deadlineDate', v_profile.cancellation_deadline_date,
      'timely', v_timely,
      'publicTokenId', p_public_token_id
    )
  );

  if not v_timely then
    return query select false, false, false, v_received_at, v_profile.cancellation_deadline_date, v_project_id;
    return;
  end if;

  update public.estimate_home_solicitation_profiles
     set cancelled_at = v_received_at,
         updated_at = v_received_at
   where id = v_profile.id;

  update public.estimates
     set status = 'void',
         updated_at = v_received_at
   where company_id = p_company_id
     and id = p_estimate_id;

  if v_project_id is not null then
    update public.projects
       set contract_compliance_hold_active = true,
           contract_compliance_hold_until = null,
           contract_compliance_hold_reason = 'Customer cancelled Ohio home-solicitation transaction',
           updated_at = v_received_at
     where company_id = p_company_id
       and id = v_project_id;
  end if;

  -- Invalidate all bearer contract links after a timely cancellation. A cancelled
  -- transaction must not remain signable through another previously issued email.
  update public.estimate_public_tokens
     set revoked_at = coalesce(revoked_at, v_received_at),
         updated_at = v_received_at
   where company_id = p_company_id
     and estimate_id = p_estimate_id
     and revoked_at is null;

  return query select true, true, false, v_received_at, v_profile.cancellation_deadline_date, v_project_id;
end;
$$;

revoke execute on function public.record_verified_home_solicitation_cancellation(uuid,uuid,uuid,timestamptz,date,text,text,text)
  from public, anon, authenticated;
grant execute on function public.record_verified_home_solicitation_cancellation(uuid,uuid,uuid,timestamptz,date,text,text,text)
  to service_role;

commit;

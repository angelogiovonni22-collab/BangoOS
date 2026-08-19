begin;

-- Public subcontract execution previously performed a chain of independent admin
-- writes. A crash between those writes could leave the master signed but the work
-- authorization unsigned (or mobilization evidence only partially updated). Move
-- the legal transition behind one service-role-only transaction and lock the
-- authorization row by bearer-token hash before changing any evidence.
create or replace function public.sign_public_subcontract_authorization(
  p_token_hash text,
  p_signer_name text,
  p_signer_title text,
  p_ip_address text default null,
  p_user_agent text default null
)
returns table(
  company_id uuid,
  assignment_id uuid,
  signed_at timestamptz,
  mobilization_status text,
  blockers jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_authorization public.project_subcontract_work_authorizations%rowtype;
  v_master public.subcontractor_master_agreements%rowtype;
  v_signed_at timestamptz := now();
  v_name text := btrim(coalesce(p_signer_name, ''));
  v_title text := btrim(coalesce(p_signer_title, ''));
  v_status text;
  v_blockers jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_token_hash, '')) = '' then
    raise exception 'Subcontract token is required.' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 200 or char_length(v_title) not between 1 and 200 then
    raise exception 'Signer name and title must contain between 1 and 200 characters.' using errcode = '22023';
  end if;

  select * into v_authorization
  from public.project_subcontract_work_authorizations a
  where a.public_token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'This subcontract link is invalid or has expired.' using errcode = 'P0002';
  end if;
  if v_authorization.token_expires_at is null or v_authorization.token_expires_at <= v_signed_at then
    update public.project_subcontract_work_authorizations
       set status = case when status = 'signed' then status else 'expired' end,
           public_token_hash = null,
           token_expires_at = null,
           updated_at = v_signed_at
     where id = v_authorization.id;
    raise exception 'This subcontract link has expired.' using errcode = '22023';
  end if;
  if v_authorization.status not in ('draft','sent') then
    raise exception 'This subcontract authorization can no longer be signed.' using errcode = '23514';
  end if;
  if v_authorization.master_agreement_id is null then
    raise exception 'The master subcontract agreement is missing.' using errcode = '23514';
  end if;

  select * into v_master
  from public.subcontractor_master_agreements m
  where m.id = v_authorization.master_agreement_id
    and m.company_id = v_authorization.company_id
    and m.vendor_id = v_authorization.vendor_id
  for update;

  if not found then
    raise exception 'The master subcontract agreement is missing.' using errcode = 'P0002';
  end if;
  if v_master.status in ('void','expired') then
    raise exception 'The master subcontract agreement can no longer be signed.' using errcode = '23514';
  end if;

  if v_master.status <> 'signed' then
    update public.subcontractor_master_agreements
       set status = 'signed',
           signer_name = v_name,
           signer_title = v_title,
           signer_email = v_authorization.signer_email,
           signed_at = v_signed_at,
           public_token_hash = null,
           token_expires_at = null,
           updated_at = v_signed_at
     where id = v_master.id
       and agreement_hash = v_master.agreement_hash;

    update public.subcontractor_mobilization_requirements
       set status = 'verified',
           verified_at = v_signed_at,
           evidence = jsonb_build_object('master_agreement_id', v_master.id, 'document_hash', v_master.agreement_hash),
           updated_at = v_signed_at
     where company_id = v_authorization.company_id
       and assignment_id = v_authorization.assignment_id
       and requirement_type = 'master_agreement';
  end if;

  update public.project_subcontract_work_authorizations
     set status = 'signed',
         signer_name = v_name,
         signer_title = v_title,
         signer_email = v_authorization.signer_email,
         signed_at = v_signed_at,
         public_token_hash = null,
         token_expires_at = null,
         updated_at = v_signed_at
   where id = v_authorization.id
     and authorization_hash = v_authorization.authorization_hash;

  insert into public.subcontractor_signature_events(
    company_id, vendor_id, assignment_id, master_agreement_id, work_authorization_id,
    event_type, signer_name, signer_title, signer_email, ip_address, user_agent,
    document_hash, metadata
  ) values (
    v_authorization.company_id,
    v_authorization.vendor_id,
    v_authorization.assignment_id,
    v_master.id,
    v_authorization.id,
    'signed',
    v_name,
    v_title,
    v_authorization.signer_email,
    nullif(btrim(coalesce(p_ip_address, '')), ''),
    nullif(btrim(coalesce(p_user_agent, '')), ''),
    v_authorization.authorization_hash,
    jsonb_build_object('master_hash', v_master.agreement_hash, 'consent_accepted', true)
  );

  update public.subcontractor_mobilization_requirements
     set status = 'verified',
         verified_at = v_signed_at,
         evidence = jsonb_build_object('work_authorization_id', v_authorization.id, 'document_hash', v_authorization.authorization_hash),
         updated_at = v_signed_at
   where company_id = v_authorization.company_id
     and assignment_id = v_authorization.assignment_id
     and requirement_type = 'work_authorization';

  update public.subcontractor_mobilization_requirements
     set status = 'verified',
         verified_at = v_signed_at,
         evidence = jsonb_build_object('signer_name', v_name),
         updated_at = v_signed_at
   where company_id = v_authorization.company_id
     and assignment_id = v_authorization.assignment_id
     and requirement_type = 'scope_confirmation';

  update public.trade_partner_assignments
     set contract_status = 'signed',
         updated_at = v_signed_at
   where company_id = v_authorization.company_id
     and id = v_authorization.assignment_id;

  select r.mobilization_status, r.blockers
    into v_status, v_blockers
  from public.refresh_subcontractor_mobilization_status(v_authorization.company_id, v_authorization.assignment_id) r;

  return query
    select v_authorization.company_id, v_authorization.assignment_id, v_signed_at,
           coalesce(v_status, 'not_cleared'), coalesce(v_blockers, '[]'::jsonb);
end;
$$;

revoke execute on function public.sign_public_subcontract_authorization(text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.sign_public_subcontract_authorization(text,text,text,text,text)
  to service_role;

commit;

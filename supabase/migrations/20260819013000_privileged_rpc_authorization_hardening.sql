begin;

-- ---------------------------------------------------------------------------
-- Privileged RPC authorization hardening
--
-- Several historical SECURITY DEFINER helpers validated only same-company
-- profile membership. That is not sufficient now that customer and trade-partner
-- accounts are real company memberships. Keep the public API names stable, but
-- require the same semantic permissions used by the application before crossing
-- a SECURITY DEFINER boundary.
-- ---------------------------------------------------------------------------

create or replace function public.allocate_project_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocated bigint;
  v_prefix text;
  v_padding integer;
begin
  if p_company_id is null then raise exception 'Company id is required'; end if;
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.bos_role_has_permission(p_company_id, 'projects.manage') then
    raise exception 'Project numbering access denied.' using errcode = '42501';
  end if;

  with upserted as (
    insert into public.company_project_sequences(company_id, prefix, padding, next_number)
    values (p_company_id, 'PRJ-', 4, 2)
    on conflict (company_id) do update
      set next_number = public.company_project_sequences.next_number + 1,
          updated_at = now()
    returning next_number, prefix, padding
  )
  select next_number - 1, prefix, padding into v_allocated, v_prefix, v_padding from upserted;
  return v_prefix || lpad(v_allocated::text, v_padding, '0');
end;
$$;

create or replace function public.allocate_estimate_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocated bigint;
  v_prefix text;
  v_padding integer;
begin
  if p_company_id is null then raise exception 'Company id is required'; end if;
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.bos_role_has_permission(p_company_id, 'estimates.manage') then
    raise exception 'Estimate numbering access denied.' using errcode = '42501';
  end if;

  with upserted as (
    insert into public.company_estimate_sequences(company_id, prefix, padding, next_number)
    values (p_company_id, 'EST-', 6, 2)
    on conflict (company_id) do update
      set next_number = public.company_estimate_sequences.next_number + 1,
          updated_at = now()
    returning next_number, prefix, padding
  )
  select next_number - 1, prefix, padding into v_allocated, v_prefix, v_padding from upserted;
  return v_prefix || lpad(v_allocated::text, v_padding, '0');
end;
$$;

create or replace function public.allocate_change_order_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocated bigint;
  v_prefix text;
  v_padding integer;
  v_year text;
begin
  if p_company_id is null then raise exception 'Company id is required'; end if;
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.bos_role_has_permission(p_company_id, 'change_orders.manage') then
    raise exception 'Change-order numbering access denied.' using errcode = '42501';
  end if;

  with upserted as (
    insert into public.company_change_order_sequences(company_id, prefix, padding, next_number)
    values (p_company_id, 'CO-', 4, 2)
    on conflict (company_id) do update
      set next_number = public.company_change_order_sequences.next_number + 1,
          updated_at = now()
    returning next_number, prefix, padding
  )
  select next_number - 1, prefix, padding into v_allocated, v_prefix, v_padding from upserted;
  v_year := to_char(current_date, 'YYYY');
  return v_prefix || v_year || '-' || lpad(v_allocated::text, v_padding, '0');
end;
$$;

revoke execute on function public.allocate_project_number(uuid) from public, anon;
revoke execute on function public.allocate_estimate_number(uuid) from public, anon;
revoke execute on function public.allocate_change_order_number(uuid) from public, anon;
grant execute on function public.allocate_project_number(uuid) to authenticated, service_role;
grant execute on function public.allocate_estimate_number(uuid) to authenticated, service_role;
grant execute on function public.allocate_change_order_number(uuid) to authenticated, service_role;

-- Preserve the mature conversion implementation behind a permission-checking
-- facade instead of duplicating a large transactional routine.
alter function public.convert_estimate_to_project(uuid,uuid,uuid,text,boolean)
  rename to bos_legacy_convert_estimate_to_project_impl;
revoke execute on function public.bos_legacy_convert_estimate_to_project_impl(uuid,uuid,uuid,text,boolean)
  from public, anon, authenticated;
grant execute on function public.bos_legacy_convert_estimate_to_project_impl(uuid,uuid,uuid,text,boolean)
  to service_role;

create function public.convert_estimate_to_project(
  p_company_id uuid,
  p_estimate_id uuid,
  p_actor_profile_id uuid,
  p_idempotency_key text,
  p_create_deposit_invoice boolean default true
)
returns table(
  conversion_id uuid,
  project_id uuid,
  project_number text,
  deposit_invoice_id uuid,
  conversion_status text,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.bos_role_has_permission(p_company_id, 'estimates.manage') then
    raise exception 'Estimate conversion access denied.' using errcode = '42501';
  end if;

  return query
    select *
    from public.bos_legacy_convert_estimate_to_project_impl(
      p_company_id,
      p_estimate_id,
      p_actor_profile_id,
      p_idempotency_key,
      p_create_deposit_invoice
    );
end;
$$;
revoke execute on function public.convert_estimate_to_project(uuid,uuid,uuid,text,boolean) from public, anon;
grant execute on function public.convert_estimate_to_project(uuid,uuid,uuid,text,boolean) to authenticated, service_role;

-- Deposit calculation reads contract/customer/compliance financial data through
-- SECURITY DEFINER. Require estimate visibility before allowing the calculation.
alter function public.calculate_estimate_deposit(uuid,uuid)
  rename to bos_legacy_calculate_estimate_deposit_impl;
revoke execute on function public.bos_legacy_calculate_estimate_deposit_impl(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.bos_legacy_calculate_estimate_deposit_impl(uuid,uuid)
  to service_role;

create function public.calculate_estimate_deposit(p_company_id uuid, p_estimate_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.bos_role_has_permission(p_company_id, 'estimates.view') then
    raise exception 'Estimate deposit access denied.' using errcode = '42501';
  end if;
  return public.bos_legacy_calculate_estimate_deposit_impl(p_company_id, p_estimate_id);
end;
$$;
revoke execute on function public.calculate_estimate_deposit(uuid,uuid) from public, anon;
grant execute on function public.calculate_estimate_deposit(uuid,uuid) to authenticated, service_role;

-- Project lifecycle RPCs historically checked only that a caller had a profile in
-- the company. Require project-management authority at the database boundary.
alter function public.soft_delete_project(uuid) rename to bos_legacy_soft_delete_project_impl;
alter function public.restore_deleted_project(uuid) rename to bos_legacy_restore_deleted_project_impl;
revoke execute on function public.bos_legacy_soft_delete_project_impl(uuid) from public, anon, authenticated;
revoke execute on function public.bos_legacy_restore_deleted_project_impl(uuid) from public, anon, authenticated;

create function public.soft_delete_project(p_project_id uuid)
returns table(history_id uuid, deleted_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select p.company_id into v_company_id from public.projects p where p.id = p_project_id;
  if v_company_id is null then raise exception 'Project not found.' using errcode = 'P0002'; end if;
  if not public.bos_role_has_permission(v_company_id, 'projects.manage') then
    raise exception 'Project lifecycle access denied.' using errcode = '42501';
  end if;
  return query select * from public.bos_legacy_soft_delete_project_impl(p_project_id);
end;
$$;

create function public.restore_deleted_project(p_project_id uuid)
returns table(history_id uuid, restored_status text, restored_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select p.company_id into v_company_id from public.projects p where p.id = p_project_id;
  if v_company_id is null then raise exception 'Project not found.' using errcode = 'P0002'; end if;
  if not public.bos_role_has_permission(v_company_id, 'projects.manage') then
    raise exception 'Project lifecycle access denied.' using errcode = '42501';
  end if;
  return query select * from public.bos_legacy_restore_deleted_project_impl(p_project_id);
end;
$$;
revoke execute on function public.soft_delete_project(uuid) from public, anon;
revoke execute on function public.restore_deleted_project(uuid) from public, anon;
grant execute on function public.soft_delete_project(uuid) to authenticated;
grant execute on function public.restore_deleted_project(uuid) to authenticated;

-- Blueprint creation/revision RPCs bypass table RLS by design, so same-company
-- membership alone is not an adequate write authorization.
alter function public.create_blueprint_sheet_upload(uuid,text,text,text)
  rename to bos_legacy_create_blueprint_sheet_upload_impl;
alter function public.register_initial_blueprint_version(uuid,text,text,text,text,bigint)
  rename to bos_legacy_register_initial_blueprint_version_impl;
alter function public.register_blueprint_revision(uuid,text,text,text,text,bigint,text)
  rename to bos_legacy_register_blueprint_revision_impl;

revoke execute on function public.bos_legacy_create_blueprint_sheet_upload_impl(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.bos_legacy_register_initial_blueprint_version_impl(uuid,text,text,text,text,bigint) from public, anon, authenticated;
revoke execute on function public.bos_legacy_register_blueprint_revision_impl(uuid,text,text,text,text,bigint,text) from public, anon, authenticated;

create function public.create_blueprint_sheet_upload(
  project_record_id uuid,
  plan_discipline text,
  plan_sheet_number text,
  plan_title text
)
returns table(company_id uuid, blueprint_set_id uuid, blueprint_sheet_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select p.company_id into v_company_id from public.projects p where p.id = project_record_id;
  if v_company_id is null then raise exception 'Blueprint project not found.' using errcode = 'P0002'; end if;
  if not public.bos_role_has_permission(v_company_id, 'blueprints.manage') then
    raise exception 'Blueprint management access denied.' using errcode = '42501';
  end if;
  return query select * from public.bos_legacy_create_blueprint_sheet_upload_impl(project_record_id, plan_discipline, plan_sheet_number, plan_title);
end;
$$;

create function public.register_initial_blueprint_version(
  sheet_record_id uuid,
  revision_name text,
  object_path text,
  source_filename text,
  source_mime_type text,
  source_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select s.company_id into v_company_id from public.blueprint_sheets s where s.id = sheet_record_id;
  if v_company_id is null then raise exception 'Blueprint sheet not found.' using errcode = 'P0002'; end if;
  if not public.bos_role_has_permission(v_company_id, 'blueprints.manage') then
    raise exception 'Blueprint management access denied.' using errcode = '42501';
  end if;
  return public.bos_legacy_register_initial_blueprint_version_impl(sheet_record_id, revision_name, object_path, source_filename, source_mime_type, source_file_size);
end;
$$;

create function public.register_blueprint_revision(
  sheet_record_id uuid,
  revision_name text,
  object_path text,
  source_filename text,
  source_mime_type text,
  source_file_size bigint,
  revision_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select s.company_id into v_company_id from public.blueprint_sheets s where s.id = sheet_record_id;
  if v_company_id is null then raise exception 'Blueprint sheet not found.' using errcode = 'P0002'; end if;
  if not public.bos_role_has_permission(v_company_id, 'blueprints.manage') then
    raise exception 'Blueprint management access denied.' using errcode = '42501';
  end if;
  return public.bos_legacy_register_blueprint_revision_impl(sheet_record_id, revision_name, object_path, source_filename, source_mime_type, source_file_size, revision_notes);
end;
$$;

revoke execute on function public.create_blueprint_sheet_upload(uuid,text,text,text) from public, anon;
revoke execute on function public.register_initial_blueprint_version(uuid,text,text,text,text,bigint) from public, anon;
revoke execute on function public.register_blueprint_revision(uuid,text,text,text,text,bigint,text) from public, anon;
grant execute on function public.create_blueprint_sheet_upload(uuid,text,text,text) to authenticated;
grant execute on function public.register_initial_blueprint_version(uuid,text,text,text,text,bigint) to authenticated;
grant execute on function public.register_blueprint_revision(uuid,text,text,text,text,bigint,text) to authenticated;

-- Mobilization refresh is only invoked by server-side admin workflows. Remove it
-- from the browser-callable RPC surface entirely.
revoke execute on function public.refresh_subcontractor_mobilization_status(uuid,uuid) from public, anon, authenticated;
grant execute on function public.refresh_subcontractor_mobilization_status(uuid,uuid) to service_role;

-- These maintenance helpers are not browser APIs.
revoke execute on function public.seed_default_system_units_of_measure() from public, anon, authenticated;
grant execute on function public.seed_default_system_units_of_measure() to service_role;
revoke execute on function public.release_expired_home_solicitation_hold(uuid,uuid) from public, anon, authenticated;
grant execute on function public.release_expired_home_solicitation_hold(uuid,uuid) to service_role;

-- Internal trade-partner messaging RPCs must exclude *all* external portal roles,
-- not only subcontractors. Customers previously inherited communications.view.
create or replace function public.get_trade_partner_message_threads()
returns table(
  assignment_id uuid,
  project_id uuid,
  project_name text,
  vendor_id uuid,
  trade_name text,
  assignment_status text,
  last_message_at timestamptz,
  message_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    tpa.id,
    tpa.project_id,
    p.name,
    tpa.vendor_id,
    tpa.trade_name,
    tpa.assignment_status,
    max(m.created_at),
    count(m.id)
  from public.trade_partner_assignments tpa
  join public.projects p on p.id = tpa.project_id and p.company_id = tpa.company_id
  left join public.trade_partner_messages m
    on m.company_id = tpa.company_id
   and m.project_id = tpa.project_id
   and m.vendor_id = tpa.vendor_id
  where public.bos_role_has_permission(tpa.company_id, 'communications.view')
    and not public.bos_is_external_company_user(tpa.company_id)
    and tpa.assignment_status = 'active'
  group by tpa.id, tpa.project_id, p.name, tpa.vendor_id, tpa.trade_name, tpa.assignment_status
  order by max(m.created_at) desc nulls last, p.name, tpa.trade_name;
$$;

create or replace function public.get_trade_partner_messages_for_assignment(p_assignment_id uuid)
returns table(
  id uuid,
  project_id uuid,
  vendor_id uuid,
  body text,
  sender_type text,
  sender_user_id uuid,
  created_at timestamptz,
  is_mine boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_assignment public.trade_partner_assignments%rowtype;
begin
  select * into v_assignment from public.trade_partner_assignments where id = p_assignment_id;
  if not found then raise exception 'Trade partner assignment not found.' using errcode = 'P0002'; end if;
  if not public.bos_role_has_permission(v_assignment.company_id, 'communications.view')
     or public.bos_is_external_company_user(v_assignment.company_id) then
    raise exception 'Trade partner message access denied.' using errcode = '42501';
  end if;

  return query
    select m.id, m.project_id, m.vendor_id, m.body, m.sender_type, m.sender_user_id, m.created_at,
           m.sender_user_id = auth.uid()
    from public.trade_partner_messages m
    where m.company_id = v_assignment.company_id
      and m.project_id = v_assignment.project_id
      and m.vendor_id = v_assignment.vendor_id
    order by m.created_at asc
    limit 500;
end;
$$;

create or replace function public.send_trade_partner_message_for_assignment(p_assignment_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.trade_partner_assignments%rowtype;
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'Message must contain between 1 and 4000 characters.' using errcode = '22023';
  end if;
  select * into v_assignment from public.trade_partner_assignments where id = p_assignment_id;
  if not found or v_assignment.assignment_status <> 'active' then
    raise exception 'Active trade partner assignment not found.' using errcode = 'P0002';
  end if;
  if not public.bos_role_has_permission(v_assignment.company_id, 'communications.manage')
     or public.bos_is_external_company_user(v_assignment.company_id) then
    raise exception 'Trade partner messaging is not authorized.' using errcode = '42501';
  end if;

  insert into public.trade_partner_messages(company_id, project_id, vendor_id, sender_user_id, sender_type, body)
  values(v_assignment.company_id, v_assignment.project_id, v_assignment.vendor_id, auth.uid(), 'internal', btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.get_trade_partner_message_threads() from public, anon;
revoke execute on function public.get_trade_partner_messages_for_assignment(uuid) from public, anon;
revoke execute on function public.send_trade_partner_message_for_assignment(uuid,text) from public, anon;
grant execute on function public.get_trade_partner_message_threads() to authenticated;
grant execute on function public.get_trade_partner_messages_for_assignment(uuid) to authenticated;
grant execute on function public.send_trade_partner_message_for_assignment(uuid,text) to authenticated;

-- Portal RPCs require an authenticated portal identity. They never need anon.
revoke execute on function public.get_my_trade_partner_jobs() from public, anon;
revoke execute on function public.get_my_customer_projects() from public, anon;
grant execute on function public.get_my_trade_partner_jobs() to authenticated;
grant execute on function public.get_my_customer_projects() to authenticated;

-- Helper predicates are used by RLS and therefore remain executable by
-- authenticated users, but anonymous browser clients have no reason to probe
-- company membership/role information.
revoke execute on function public.is_company_member(uuid,uuid) from public, anon;
revoke execute on function public.has_company_role(uuid,text[],uuid) from public, anon;
revoke execute on function public.bos_role_has_permission(uuid,text,uuid) from public, anon;
revoke execute on function public.bos_is_trade_partner_for_company(uuid,uuid) from public, anon;
revoke execute on function public.bos_can_access_trade_partner_project(uuid,uuid) from public, anon;
grant execute on function public.is_company_member(uuid,uuid) to authenticated, service_role;
grant execute on function public.has_company_role(uuid,text[],uuid) to authenticated, service_role;
grant execute on function public.bos_role_has_permission(uuid,text,uuid) to authenticated, service_role;
grant execute on function public.bos_is_trade_partner_for_company(uuid,uuid) to authenticated, service_role;
grant execute on function public.bos_can_access_trade_partner_project(uuid,uuid) to authenticated, service_role;

commit;

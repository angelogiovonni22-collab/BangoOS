begin;

-- Permission overrides must never turn a portal-only customer or subcontractor
-- into an internal operator at a SECURITY DEFINER boundary. Route guards are not
-- a substitute for database authorization, so every privileged facade rejects
-- external company roles explicitly.

create or replace function public.allocate_project_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_allocated bigint; v_prefix text; v_padding integer;
begin
  if p_company_id is null then raise exception 'Company id is required'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and (
       public.bos_is_external_company_user(p_company_id)
       or not public.bos_role_has_permission(p_company_id, 'projects.manage')
     ) then raise exception 'Project numbering access denied.' using errcode='42501'; end if;
  with upserted as (
    insert into public.company_project_sequences(company_id,prefix,padding,next_number)
    values(p_company_id,'PRJ-',4,2)
    on conflict(company_id) do update
      set next_number=public.company_project_sequences.next_number+1,updated_at=now()
    returning next_number,prefix,padding
  ) select next_number-1,prefix,padding into v_allocated,v_prefix,v_padding from upserted;
  return v_prefix || lpad(v_allocated::text,v_padding,'0');
end;
$$;

create or replace function public.allocate_estimate_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_allocated bigint; v_prefix text; v_padding integer;
begin
  if p_company_id is null then raise exception 'Company id is required'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and (
       public.bos_is_external_company_user(p_company_id)
       or not public.bos_role_has_permission(p_company_id, 'estimates.manage')
     ) then raise exception 'Estimate numbering access denied.' using errcode='42501'; end if;
  with upserted as (
    insert into public.company_estimate_sequences(company_id,prefix,padding,next_number)
    values(p_company_id,'EST-',6,2)
    on conflict(company_id) do update
      set next_number=public.company_estimate_sequences.next_number+1,updated_at=now()
    returning next_number,prefix,padding
  ) select next_number-1,prefix,padding into v_allocated,v_prefix,v_padding from upserted;
  return v_prefix || lpad(v_allocated::text,v_padding,'0');
end;
$$;

create or replace function public.allocate_change_order_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_allocated bigint; v_prefix text; v_padding integer; v_year text;
begin
  if p_company_id is null then raise exception 'Company id is required'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and (
       public.bos_is_external_company_user(p_company_id)
       or not public.bos_role_has_permission(p_company_id, 'change_orders.manage')
     ) then raise exception 'Change-order numbering access denied.' using errcode='42501'; end if;
  with upserted as (
    insert into public.company_change_order_sequences(company_id,prefix,padding,next_number)
    values(p_company_id,'CO-',4,2)
    on conflict(company_id) do update
      set next_number=public.company_change_order_sequences.next_number+1,updated_at=now()
    returning next_number,prefix,padding
  ) select next_number-1,prefix,padding into v_allocated,v_prefix,v_padding from upserted;
  v_year:=to_char(current_date,'YYYY');
  return v_prefix || v_year || '-' || lpad(v_allocated::text,v_padding,'0');
end;
$$;

create or replace function public.convert_estimate_to_project(
  p_company_id uuid,p_estimate_id uuid,p_actor_profile_id uuid,p_idempotency_key text,
  p_create_deposit_invoice boolean default true
)
returns table(conversion_id uuid,project_id uuid,project_number text,deposit_invoice_id uuid,conversion_status text,idempotent boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
       public.bos_is_external_company_user(p_company_id)
       or not public.bos_role_has_permission(p_company_id,'estimates.manage')
     ) then raise exception 'Estimate conversion access denied.' using errcode='42501'; end if;
  return query select * from public.bos_legacy_convert_estimate_to_project_impl(
    p_company_id,p_estimate_id,p_actor_profile_id,p_idempotency_key,p_create_deposit_invoice
  );
end;
$$;

create or replace function public.calculate_estimate_deposit(p_company_id uuid,p_estimate_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
       public.bos_is_external_company_user(p_company_id)
       or not public.bos_role_has_permission(p_company_id,'estimates.view')
     ) then raise exception 'Estimate deposit access denied.' using errcode='42501'; end if;
  return public.bos_legacy_calculate_estimate_deposit_impl(p_company_id,p_estimate_id);
end;
$$;

create or replace function public.soft_delete_project(p_project_id uuid)
returns table(history_id uuid,deleted_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select p.company_id into v_company_id from public.projects p where p.id=p_project_id;
  if v_company_id is null then raise exception 'Project not found.' using errcode='P0002'; end if;
  if public.bos_is_external_company_user(v_company_id)
     or not public.bos_role_has_permission(v_company_id,'projects.manage') then
    raise exception 'Project lifecycle access denied.' using errcode='42501';
  end if;
  return query select * from public.bos_legacy_soft_delete_project_impl(p_project_id);
end;
$$;

create or replace function public.restore_deleted_project(p_project_id uuid)
returns table(history_id uuid,restored_status text,restored_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select p.company_id into v_company_id from public.projects p where p.id=p_project_id;
  if v_company_id is null then raise exception 'Project not found.' using errcode='P0002'; end if;
  if public.bos_is_external_company_user(v_company_id)
     or not public.bos_role_has_permission(v_company_id,'projects.manage') then
    raise exception 'Project lifecycle access denied.' using errcode='42501';
  end if;
  return query select * from public.bos_legacy_restore_deleted_project_impl(p_project_id);
end;
$$;

create or replace function public.create_blueprint_sheet_upload(
  project_record_id uuid,plan_discipline text,plan_sheet_number text,plan_title text
)
returns table(company_id uuid,blueprint_set_id uuid,blueprint_sheet_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select p.company_id into v_company_id from public.projects p where p.id=project_record_id;
  if v_company_id is null then raise exception 'Blueprint project not found.' using errcode='P0002'; end if;
  if public.bos_is_external_company_user(v_company_id)
     or not public.bos_role_has_permission(v_company_id,'blueprints.manage') then
    raise exception 'Blueprint management access denied.' using errcode='42501';
  end if;
  return query select * from public.bos_legacy_create_blueprint_sheet_upload_impl(project_record_id,plan_discipline,plan_sheet_number,plan_title);
end;
$$;

create or replace function public.register_initial_blueprint_version(
  sheet_record_id uuid,revision_name text,object_path text,source_filename text,source_mime_type text,source_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select s.company_id into v_company_id from public.blueprint_sheets s where s.id=sheet_record_id;
  if v_company_id is null then raise exception 'Blueprint sheet not found.' using errcode='P0002'; end if;
  if public.bos_is_external_company_user(v_company_id)
     or not public.bos_role_has_permission(v_company_id,'blueprints.manage') then
    raise exception 'Blueprint management access denied.' using errcode='42501';
  end if;
  return public.bos_legacy_register_initial_blueprint_version_impl(sheet_record_id,revision_name,object_path,source_filename,source_mime_type,source_file_size);
end;
$$;

create or replace function public.register_blueprint_revision(
  sheet_record_id uuid,revision_name text,object_path text,source_filename text,source_mime_type text,source_file_size bigint,
  revision_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  select s.company_id into v_company_id from public.blueprint_sheets s where s.id=sheet_record_id;
  if v_company_id is null then raise exception 'Blueprint sheet not found.' using errcode='P0002'; end if;
  if public.bos_is_external_company_user(v_company_id)
     or not public.bos_role_has_permission(v_company_id,'blueprints.manage') then
    raise exception 'Blueprint management access denied.' using errcode='42501';
  end if;
  return public.bos_legacy_register_blueprint_revision_impl(sheet_record_id,revision_name,object_path,source_filename,source_mime_type,source_file_size,revision_notes);
end;
$$;

-- Contract-work-start assertions are internal authenticated compliance helpers.
-- They may expose contract state through their exception codes, so require
-- internal estimate visibility and remove anonymous execution.
create or replace function public.assert_estimate_work_may_begin(p_company_id uuid,p_estimate_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_profile public.estimate_home_solicitation_profiles%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' and (
       public.bos_is_external_company_user(p_company_id)
       or not public.bos_role_has_permission(p_company_id,'estimates.view')
     ) then raise exception 'Estimate work-start access denied.' using errcode='42501'; end if;
  select * into v_profile from public.estimate_home_solicitation_profiles
  where company_id=p_company_id and estimate_id=p_estimate_id;
  if not found then return; end if;
  if v_profile.cancelled_at is not null then raise exception 'CONTRACT_CANCELLED'; end if;
  if v_profile.work_start_hold_configured and v_profile.work_released_at is null
     and v_profile.cancellation_deadline_date is not null
     and current_date <= v_profile.cancellation_deadline_date then
    raise exception 'HOME_SOLICITATION_CANCELLATION_HOLD';
  end if;
end;
$$;
revoke execute on function public.assert_estimate_work_may_begin(uuid,uuid) from public, anon;
grant execute on function public.assert_estimate_work_may_begin(uuid,uuid) to authenticated, service_role;

-- RLS helper predicates are not anonymous discovery APIs. They remain executable
-- by authenticated users because storage/table policies call them.
revoke execute on function public.blueprint_member_of_company(uuid) from public, anon;
revoke execute on function public.blueprint_project_belongs_to_company(uuid,uuid) from public, anon;
revoke execute on function public.record_attachment_entity_belongs_to_company(text,uuid,uuid) from public, anon;
grant execute on function public.blueprint_member_of_company(uuid) to authenticated, service_role;
grant execute on function public.blueprint_project_belongs_to_company(uuid,uuid) to authenticated, service_role;
grant execute on function public.record_attachment_entity_belongs_to_company(text,uuid,uuid) to authenticated, service_role;

-- Trigger functions are invoked by their triggers and should not be directly
-- executable from PostgREST roles.
revoke execute on function public.publish_blueprint_revision_ack_event() from public, anon, authenticated;
revoke execute on function public.publish_blueprint_revision_status_event() from public, anon, authenticated;
revoke execute on function public.trg_company_memberships_sync_profiles_fn() from public, anon, authenticated;
revoke execute on function public.trg_crew_memberships_validate_fn() from public, anon, authenticated;

commit;

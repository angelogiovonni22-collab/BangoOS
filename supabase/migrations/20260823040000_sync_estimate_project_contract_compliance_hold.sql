create or replace function public.sync_estimate_project_contract_compliance_hold(
  p_company_id uuid,
  p_estimate_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.estimate_home_solicitation_profiles%rowtype;
  v_project_id uuid;
  v_hold_until timestamptz;
begin
  select e.project_id into v_project_id
  from public.estimates e
  where e.company_id = p_company_id and e.id = p_estimate_id;

  if v_project_id is null then return; end if;

  select * into v_profile
  from public.estimate_home_solicitation_profiles h
  where h.company_id = p_company_id and h.estimate_id = p_estimate_id;

  if not found then return; end if;

  if v_profile.cancelled_at is not null then
    update public.projects
    set contract_compliance_hold_active = true,
        contract_compliance_hold_until = null,
        contract_compliance_hold_reason = 'Customer cancelled Ohio home-solicitation transaction'
    where company_id = p_company_id and id = v_project_id;
    return;
  end if;

  if v_profile.work_start_hold_configured
     and v_profile.work_released_at is null
     and v_profile.cancellation_deadline_date is not null
     and current_date <= v_profile.cancellation_deadline_date then
    v_hold_until := ((v_profile.cancellation_deadline_date + 1)::text || ' 05:00:00+00')::timestamptz;
    update public.projects
    set contract_compliance_hold_active = true,
        contract_compliance_hold_until = v_hold_until,
        contract_compliance_hold_reason = 'Ohio home-solicitation cancellation period'
    where company_id = p_company_id and id = v_project_id;
    return;
  end if;

  update public.projects
  set contract_compliance_hold_active = false,
      contract_compliance_hold_until = null,
      contract_compliance_hold_reason = null
  where company_id = p_company_id
    and id = v_project_id
    and contract_compliance_hold_reason in (
      'Ohio home-solicitation cancellation period',
      'Customer cancelled Ohio home-solicitation transaction'
    );
end;
$$;

comment on function public.sync_estimate_project_contract_compliance_hold(uuid, uuid) is
  'Synchronizes the converted project hold from the canonical Ohio home-solicitation profile without overwriting unrelated project holds.';

revoke all on function public.sync_estimate_project_contract_compliance_hold(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sync_estimate_project_contract_compliance_hold(uuid, uuid) to service_role;

create or replace function public.sync_estimate_project_contract_compliance_hold_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_estimate_project_contract_compliance_hold(new.company_id, new.estimate_id);
  return new;
end;
$$;

revoke all on function public.sync_estimate_project_contract_compliance_hold_from_profile() from public, anon, authenticated;

drop trigger if exists estimate_home_solicitation_sync_project_hold on public.estimate_home_solicitation_profiles;
create trigger estimate_home_solicitation_sync_project_hold
after insert or update of transaction_signed_at, cancellation_deadline_date, cancelled_at, work_released_at, work_start_hold_configured
on public.estimate_home_solicitation_profiles
for each row
execute function public.sync_estimate_project_contract_compliance_hold_from_profile();

create or replace function public.sync_estimate_project_contract_compliance_hold_from_estimate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null then
    perform public.sync_estimate_project_contract_compliance_hold(new.company_id, new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.sync_estimate_project_contract_compliance_hold_from_estimate() from public, anon, authenticated;

drop trigger if exists estimates_sync_project_contract_compliance_hold on public.estimates;
create trigger estimates_sync_project_contract_compliance_hold
after insert or update of project_id
on public.estimates
for each row
when (new.project_id is not null)
execute function public.sync_estimate_project_contract_compliance_hold_from_estimate();

do $$
declare v_row record;
begin
  for v_row in
    select h.company_id, h.estimate_id
    from public.estimate_home_solicitation_profiles h
    join public.estimates e on e.company_id = h.company_id and e.id = h.estimate_id
    where e.project_id is not null
  loop
    perform public.sync_estimate_project_contract_compliance_hold(v_row.company_id, v_row.estimate_id);
  end loop;
end;
$$;

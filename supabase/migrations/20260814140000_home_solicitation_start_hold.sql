create or replace function public.assert_estimate_work_may_begin(
  p_company_id uuid,
  p_estimate_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.estimate_home_solicitation_profiles%rowtype;
begin
  select * into v_profile
  from public.estimate_home_solicitation_profiles
  where company_id = p_company_id and estimate_id = p_estimate_id;

  if not found then
    return;
  end if;

  if v_profile.cancelled_at is not null then
    raise exception 'CONTRACT_CANCELLED';
  end if;

  if v_profile.work_start_hold_configured
     and v_profile.work_released_at is null
     and v_profile.cancellation_deadline_date is not null
     and current_date <= v_profile.cancellation_deadline_date then
    raise exception 'HOME_SOLICITATION_CANCELLATION_HOLD';
  end if;
end;
$$;

comment on function public.assert_estimate_work_may_begin(uuid, uuid) is
  'Server-side guard for operational workflows that would begin work on an estimate subject to an active Ohio home-solicitation cancellation hold.';

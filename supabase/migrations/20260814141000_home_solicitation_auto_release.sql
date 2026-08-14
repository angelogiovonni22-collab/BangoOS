create or replace function public.release_expired_home_solicitation_hold(
  p_company_id uuid,
  p_estimate_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.estimate_home_solicitation_profiles%rowtype;
begin
  select * into v_profile
  from public.estimate_home_solicitation_profiles
  where company_id = p_company_id and estimate_id = p_estimate_id
  for update;

  if not found or v_profile.cancelled_at is not null then
    return false;
  end if;

  if v_profile.work_start_hold_configured
     and v_profile.work_released_at is null
     and v_profile.cancellation_deadline_date is not null
     and current_date > v_profile.cancellation_deadline_date then
    update public.estimate_home_solicitation_profiles
      set work_released_at = now(), updated_at = now()
      where id = v_profile.id;
    return true;
  end if;

  return v_profile.work_released_at is not null;
end;
$$;

comment on function public.release_expired_home_solicitation_hold(uuid, uuid) is
  'Releases an Ohio home-solicitation work-start hold only after the statutory cancellation deadline has passed and no cancellation is recorded.';

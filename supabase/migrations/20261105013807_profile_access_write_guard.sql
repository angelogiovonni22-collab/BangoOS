-- Profile access mirrors verified membership or actual company ownership.
-- Personal profile fields remain editable through the existing own-row policies.
create or replace function public.guard_profile_access_writes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Membership synchronization and trusted onboarding/invite backends run as
  -- their database role, not as a client-supplied JWT role.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if auth.uid() is null or new.id is distinct from auth.uid() then
    raise exception 'Profile access changes require verified company access' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.id = old.id
       and new.company_id is not distinct from old.company_id
       and new.role is not distinct from old.role then
      return new;
    end if;
  end if;

  if new.company_id is null then
    if tg_op = 'INSERT' and new.role in ('member', 'employee') then
      return new;
    end if;
    if tg_op = 'UPDATE' then
      if new.role is not distinct from old.role then
        return new;
      end if;
    end if;
  elsif exists (
    select 1 from public.company_memberships cm
    where cm.company_id = new.company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.role = new.role
  ) or (
    new.role = 'owner'
    and exists (
      select 1 from public.companies c
      where c.id = new.company_id and c.owner_id = auth.uid()
    )
  ) then
    return new;
  end if;

  raise exception 'Profile access changes require verified company access' using errcode = '42501';
end;
$$;

revoke all on function public.guard_profile_access_writes() from public, anon, authenticated;

drop trigger if exists trg_profiles_guard_access_writes on public.profiles;
create trigger trg_profiles_guard_access_writes
before insert or update on public.profiles
for each row execute function public.guard_profile_access_writes();

-- Keep primary-workspace selection available while protecting authorization fields.
-- This runs as the caller and retains the existing company-admin/owner policy model.
create or replace function public.guard_company_membership_writes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid;
  v_company uuid;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication is required to change company access.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    v_company := old.company_id;
  else
    v_company := new.company_id;
  end if;

  -- has_company_role also recognizes the actual company owner before bootstrap.
  if public.has_company_role(v_company, array['owner', 'administrator']::text[], v_actor) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.user_id = v_actor
      and (pg_catalog.to_jsonb(new) - 'is_primary' - 'updated_at')
        is not distinct from (pg_catalog.to_jsonb(old) - 'is_primary' - 'updated_at')
    then
      return new;
    end if;
  end if;

  raise exception 'Only company owners or administrators can change company access. You may only select your own primary workspace.'
    using errcode = '42501';
end;
$$;

revoke all on function public.guard_company_membership_writes() from public, anon, authenticated;
drop trigger if exists trg_company_memberships_guard_writes on public.company_memberships;
create trigger trg_company_memberships_guard_writes
before insert or update on public.company_memberships
for each row execute function public.guard_company_membership_writes();

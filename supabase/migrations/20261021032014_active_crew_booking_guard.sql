begin;

-- Preserve historical bookings, but validate every new or changed active crew booking,
-- including direct table writes and RPC callers. Invoker retains company RLS.
create function public.enforce_active_crew_booking()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.crew_id is null or new.status not in ('planned','confirmed','in_progress') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.company_id is not distinct from old.company_id
      and new.crew_id is not distinct from old.crew_id
      and new.status is not distinct from old.status
      and new.starts_at is not distinct from old.starts_at
      and new.ends_at is not distinct from old.ends_at then
      return new;
    end if;
  end if;
  -- SHARE conflicts with a concurrent crew status UPDATE until the booking commits.
  perform 1 from public.crews c
    where c.id = new.crew_id and c.company_id = new.company_id and c.status = 'active'
    for share;
  if not found then
    raise exception 'Only active crews can receive new assignments. Select an active crew.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_active_crew_booking() from public,anon,authenticated;
create trigger trg_enforce_active_crew_booking
before insert or update of company_id,crew_id,status,starts_at,ends_at
on public.workforce_assignments
for each row execute function public.enforce_active_crew_booking();

commit;

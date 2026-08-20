begin;

-- Keep the signed-estimate lifecycle from ever committing an approved estimate
-- without completing its verified customer/project conversion. The public signing
-- route verifies the signature first and then marks the estimate approved. This
-- trigger runs inside the estimate approval transaction, so a conversion failure
-- rolls the approval update back instead of leaving an approved-but-unconverted
-- estimate that cannot be retried safely.
create or replace function public.ensure_approved_estimate_conversion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_profile_id uuid;
begin
  if new.status <> 'approved'
     or new.approval_signature_id is null
     or new.converted_project_id is not null then
    return new;
  end if;

  v_actor_profile_id := coalesce(new.updated_by, new.created_by);

  if v_actor_profile_id is null
     or not exists (
       select 1
       from public.profiles p
       where p.id = v_actor_profile_id
         and p.company_id = new.company_id
     ) then
    select p.id
      into v_actor_profile_id
    from public.profiles p
    where p.company_id = new.company_id
    order by p.created_at asc
    limit 1;
  end if;

  if v_actor_profile_id is null then
    raise exception 'A company profile is required to finalize this estimate';
  end if;

  perform *
  from public.convert_verified_estimate_contract(
    new.company_id,
    new.id,
    new.approval_signature_id,
    v_actor_profile_id
  );

  return new;
end;
$$;

revoke all on function public.ensure_approved_estimate_conversion() from public, anon, authenticated;

-- Fire only when the approval/signature columns are written. The conversion RPC
-- updates project/customer conversion columns but not status or signature, so its
-- own estimate update cannot recursively fire this trigger.
drop trigger if exists estimates_ensure_approved_conversion on public.estimates;
create trigger estimates_ensure_approved_conversion
after update of status, approval_signature_id on public.estimates
for each row
when (
  new.status = 'approved'
  and new.approval_signature_id is not null
  and new.converted_project_id is null
)
execute function public.ensure_approved_estimate_conversion();

-- Repair any verified agreements that were approved before the transactional
-- guard existed. The conversion RPC is advisory-locked and idempotent, so this is
-- safe to run once during deployment and safe if a row was concurrently repaired.
do $$
declare
  r record;
  v_actor_profile_id uuid;
begin
  for r in
    select
      e.company_id,
      e.id as estimate_id,
      e.approval_signature_id,
      e.updated_by,
      e.created_by
    from public.estimates e
    where e.status = 'approved'
      and e.converted_project_id is null
      and e.approval_signature_id is not null
      and exists (
        select 1
        from public.estimate_signatures s
        where s.id = e.approval_signature_id
          and s.company_id = e.company_id
          and s.estimate_id = e.id
          and s.verification_result = 'verified'
      )
  loop
    v_actor_profile_id := coalesce(r.updated_by, r.created_by);

    if v_actor_profile_id is null
       or not exists (
         select 1
         from public.profiles p
         where p.id = v_actor_profile_id
           and p.company_id = r.company_id
       ) then
      select p.id
        into v_actor_profile_id
      from public.profiles p
      where p.company_id = r.company_id
      order by p.created_at asc
      limit 1;
    end if;

    if v_actor_profile_id is not null then
      perform *
      from public.convert_verified_estimate_contract(
        r.company_id,
        r.estimate_id,
        r.approval_signature_id,
        v_actor_profile_id
      );
    end if;
  end loop;
end;
$$;

commit;

begin;

create or replace function public.refresh_subcontractor_mobilization_status(
  p_company_id uuid,
  p_assignment_id uuid
) returns table(mobilization_status text, blockers jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blockers jsonb;
  v_status text;
begin
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and not exists (
       select 1 from public.profiles
       where id = auth.uid() and company_id = p_company_id
     ) then
    raise exception 'Unauthorized subcontractor mobilization access';
  end if;

  if not exists (
    select 1 from public.trade_partner_assignments
    where id = p_assignment_id and company_id = p_company_id
  ) then
    raise exception 'Subcontractor assignment not found';
  end if;

  select coalesce(jsonb_agg(requirement_type order by requirement_type), '[]'::jsonb)
    into v_blockers
  from public.subcontractor_mobilization_requirements
  where company_id = p_company_id
    and assignment_id = p_assignment_id
    and required = true
    and status not in ('verified','waived');

  v_status := case when jsonb_array_length(v_blockers) = 0 then 'cleared' else 'not_cleared' end;

  update public.trade_partner_assignments
     set mobilization_status = v_status,
         mobilization_blockers = v_blockers,
         mobilization_cleared_at = case when v_status = 'cleared' then coalesce(mobilization_cleared_at, now()) else null end,
         updated_at = now()
   where id = p_assignment_id and company_id = p_company_id;

  return query select v_status, v_blockers;
end;
$$;

revoke all on function public.refresh_subcontractor_mobilization_status(uuid, uuid) from public, anon;
grant execute on function public.refresh_subcontractor_mobilization_status(uuid, uuid) to authenticated, service_role;

commit;

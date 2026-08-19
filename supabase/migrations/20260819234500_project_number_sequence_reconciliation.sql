create or replace function public.allocate_project_number_for_actor(
  p_company_id uuid,
  p_actor_profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text := 'PRJ-';
  v_padding integer := 4;
  v_sequence_next bigint;
  v_max_existing bigint := 0;
  v_allocated bigint;
begin
  if p_company_id is null or p_actor_profile_id is null then
    raise exception 'Company id and actor profile id are required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_profile_id
      and p.company_id = p_company_id
  ) then
    raise exception 'Company actor required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('project-number:' || p_company_id::text, 0));

  select s.prefix, s.padding, s.next_number
    into v_prefix, v_padding, v_sequence_next
  from public.company_project_sequences s
  where s.company_id = p_company_id
  for update;

  v_prefix := coalesce(v_prefix, 'PRJ-');
  v_padding := coalesce(v_padding, 4);
  v_sequence_next := coalesce(v_sequence_next, 1);

  select coalesce(max(substring(p.project_number from '([0-9]+)$')::bigint), 0)
    into v_max_existing
  from public.projects p
  where p.company_id = p_company_id
    and p.project_number is not null
    and p.project_number ~ '[0-9]+$';

  v_allocated := greatest(v_sequence_next, v_max_existing + 1);

  insert into public.company_project_sequences (
    company_id, prefix, padding, next_number, updated_at
  ) values (
    p_company_id, v_prefix, v_padding, v_allocated + 1, now()
  )
  on conflict (company_id)
  do update set
    prefix = excluded.prefix,
    padding = excluded.padding,
    next_number = excluded.next_number,
    updated_at = now();

  return v_prefix || lpad(v_allocated::text, v_padding, '0');
end;
$$;

revoke all on function public.allocate_project_number_for_actor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.allocate_project_number_for_actor(uuid, uuid) to service_role;

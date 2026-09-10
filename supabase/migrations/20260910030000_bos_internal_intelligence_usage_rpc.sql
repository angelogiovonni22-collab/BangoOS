begin;

create or replace function public.record_bos_internal_intelligence_usage_event(
  p_company_id uuid,
  p_product text,
  p_operation_key text,
  p_source_type text default null,
  p_source_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_product not in ('orion_text', 'orion_voice', 'orion_document', 'orion_autonomous_action', 'blueprint_native_analysis', 'blueprint_3d_reconstruction') then
    raise exception 'Unsupported internal intelligence product';
  end if;

  if char_length(btrim(p_operation_key)) < 8 or char_length(btrim(p_operation_key)) > 200 then
    raise exception 'Invalid operation key';
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Metadata must be a JSON object';
  end if;

  if not exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = p_company_id
      and membership.user_id = v_user_id
      and membership.status = 'active'
  ) then
    raise exception 'Active company membership required';
  end if;

  if p_source_type = 'project' and p_source_id is not null and not exists (
    select 1 from public.projects project
    where project.id = p_source_id and project.company_id = p_company_id
  ) then
    raise exception 'Project does not belong to company';
  end if;

  insert into public.bos_intelligence_usage_events (
    company_id, actor_user_id, product, outcome, quantity, internal_non_billable,
    provider, provider_model, provider_request_id, input_units, output_units, total_units,
    provider_cost_micros, operation_key, source_type, source_id, metadata
  ) values (
    p_company_id, v_user_id, p_product, 'succeeded', 1, true,
    null, null, null, null, null, null,
    0, p_operation_key, p_source_type, p_source_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('recordingMode', 'authenticated_internal_rpc')
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.record_bos_internal_intelligence_usage_event(uuid,text,text,text,uuid,jsonb) from public;
grant execute on function public.record_bos_internal_intelligence_usage_event(uuid,text,text,text,uuid,jsonb) to authenticated;

comment on function public.record_bos_internal_intelligence_usage_event(uuid,text,text,text,uuid,jsonb) is
  'Records strictly non-billable internal B.O.S. intelligence usage for the authenticated user after tenant/source validation. This function cannot settle credits or create customer charges.';

commit;

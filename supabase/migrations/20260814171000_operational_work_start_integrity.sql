begin;

create or replace function public.trg_operational_work_start_integrity_fn()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_change_order_estimate_id uuid;
  v_estimate_project_id uuid;
begin
  select e.project_id into v_estimate_project_id
  from public.estimates e
  where e.id = new.estimate_id
    and e.company_id = new.company_id;

  if not found then
    raise exception 'GOVERNING_ESTIMATE_NOT_FOUND';
  end if;

  if new.project_id is distinct from v_estimate_project_id then
    raise exception 'OPERATIONAL_PROJECT_ESTIMATE_MISMATCH';
  end if;

  if new.change_order_id is not null then
    select co.estimate_id into v_change_order_estimate_id
    from public.change_orders co
    where co.id = new.change_order_id
      and co.company_id = new.company_id;

    if not found then
      raise exception 'CHANGE_ORDER_NOT_FOUND';
    end if;

    if v_change_order_estimate_id is null
       or v_change_order_estimate_id <> new.estimate_id then
      raise exception 'CHANGE_ORDER_GOVERNING_ESTIMATE_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_operational_work_start_integrity
  on public.operational_work_start_authorizations;
create trigger trg_operational_work_start_integrity
before insert on public.operational_work_start_authorizations
for each row execute function public.trg_operational_work_start_integrity_fn();

create or replace function public.get_operational_work_start_decision(
  p_company_id uuid,
  p_estimate_id uuid,
  p_change_order_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid;
  v_change_order_estimate_id uuid;
  v_message text;
  v_code text;
begin
  select e.project_id into v_project_id
  from public.estimates e
  where e.id = p_estimate_id and e.company_id = p_company_id;

  if not found then
    return jsonb_build_object(
      'decision','BLOCKED',
      'estimateId',p_estimate_id,
      'changeOrderId',p_change_order_id,
      'blockerCode','GOVERNING_ESTIMATE_NOT_FOUND',
      'blockerMessage','A governing contract estimate is required before work can begin.'
    );
  end if;

  if p_change_order_id is not null then
    select co.estimate_id into v_change_order_estimate_id
    from public.change_orders co
    where co.id = p_change_order_id
      and co.company_id = p_company_id;

    if not found then
      return jsonb_build_object(
        'decision','BLOCKED','projectId',v_project_id,'estimateId',p_estimate_id,
        'changeOrderId',p_change_order_id,'blockerCode','CHANGE_ORDER_NOT_FOUND',
        'blockerMessage','The change order is not available in this company.'
      );
    end if;

    if v_change_order_estimate_id is null then
      return jsonb_build_object(
        'decision','BLOCKED','projectId',v_project_id,'estimateId',p_estimate_id,
        'changeOrderId',p_change_order_id,'blockerCode','GOVERNING_ESTIMATE_REQUIRED',
        'blockerMessage','The change order must be linked to its governing contract estimate before work begins.'
      );
    end if;

    if v_change_order_estimate_id <> p_estimate_id then
      return jsonb_build_object(
        'decision','BLOCKED','projectId',v_project_id,'estimateId',p_estimate_id,
        'changeOrderId',p_change_order_id,'blockerCode','CHANGE_ORDER_GOVERNING_ESTIMATE_MISMATCH',
        'blockerMessage','The supplied estimate is not the governing contract for this change order.'
      );
    end if;
  end if;

  begin
    if p_change_order_id is null then
      perform public.assert_operational_estimate_work_may_begin(p_company_id, p_estimate_id);
    else
      perform public.assert_operational_change_order_work_may_begin(p_company_id, p_change_order_id);
    end if;
  exception when others then
    get stacked diagnostics v_message = message_text;
    v_code := case
      when v_message like '%HOME_SOLICITATION_CANCELLATION_HOLD%' then 'HOME_SOLICITATION_CANCELLATION_HOLD'
      when v_message like '%CONTRACT_CANCELLED%' then 'CONTRACT_CANCELLED'
      when v_message like '%GOVERNING_ESTIMATE_REQUIRED%' then 'GOVERNING_ESTIMATE_REQUIRED'
      when v_message like '%Change-order work start blocked by compliance:%' then 'CHANGE_ORDER_EXCESS_COST_BLOCKED'
      else 'COMPLIANCE_REVIEW_REQUIRED'
    end;

    return jsonb_build_object(
      'decision','BLOCKED','projectId',v_project_id,'estimateId',p_estimate_id,
      'changeOrderId',p_change_order_id,'blockerCode',v_code,'blockerMessage',v_message
    );
  end;

  return jsonb_build_object(
    'decision','ALLOWED','projectId',v_project_id,'estimateId',p_estimate_id,
    'changeOrderId',p_change_order_id,'blockerCode',null,'blockerMessage',null
  );
end;
$$;

comment on function public.trg_operational_work_start_integrity_fn() is
  'Prevents operational authorization evidence from being labeled with a project or estimate that does not actually govern the requested work.';

commit;

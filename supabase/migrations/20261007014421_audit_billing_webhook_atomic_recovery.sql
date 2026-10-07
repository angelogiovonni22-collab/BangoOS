begin;

alter table public.bos_billing_webhook_events
  add column if not exists payload_fingerprint text,
  add column if not exists processing_attempts integer not null default 0;

-- This entire RPC is one transaction: a retry cannot acknowledge an incomplete
-- tenant mutation, and a completion failure rolls the tenant mutation back.
create function public.apply_billing_webhook_event(
  p_event jsonb, p_company_id uuid, p_update jsonb,
  p_processing_error text default null
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  v_event public.bos_billing_webhook_events%rowtype;
  v_tenant public.bos_tenant_accounts%rowtype;
  v_patch public.bos_tenant_accounts%rowtype;
  v_id text := p_event->>'id';
  v_type text := p_event->>'type';
  v_created timestamptz := to_timestamp((p_event->>'created')::double precision);
  v_fingerprint text := encode(sha256(convert_to(p_event::text, 'UTF8')), 'hex');
  v_company_id uuid;
  v_message text;
  v_known boolean;
begin
  if nullif(v_id, '') is null or nullif(v_type, '') is null
     or jsonb_typeof(p_event->'livemode') is distinct from 'boolean'
     or v_created is null then
    raise exception 'Invalid billing event identity.' using errcode = '22023';
  end if;
  insert into public.bos_billing_webhook_events
    (stripe_event_id, event_type, livemode, event_created_at, payload_fingerprint)
  values (v_id, v_type, (p_event->>'livemode')::boolean, v_created, v_fingerprint)
  on conflict (stripe_event_id) do nothing;
  select * into strict v_event from public.bos_billing_webhook_events
    where stripe_event_id = v_id for update;
  if v_event.event_type <> v_type or v_event.livemode <> (p_event->>'livemode')::boolean
     or (v_event.event_created_at is not null and v_event.event_created_at <> v_created)
     or (v_event.payload_fingerprint is not null and v_event.payload_fingerprint <> v_fingerprint) then
    raise exception 'Billing event ID was reused with a different payload.' using errcode = '22023';
  end if;
  if v_event.processing_status in ('processed', 'ignored') then
    return jsonb_build_object('status', v_event.processing_status, 'duplicate', true);
  end if;
  update public.bos_billing_webhook_events set
    payload_fingerprint = v_fingerprint, processing_attempts = processing_attempts + 1
    where stripe_event_id = v_id;
  v_known := v_type = 'checkout.session.completed'
    or v_type like 'customer.subscription.%'
    or v_type in ('invoice.paid', 'invoice.payment_failed');
  begin
    if p_processing_error is not null then
      raise exception '%', left(p_processing_error, 1000);
    end if;
    if v_known then
      if p_company_id is null or jsonb_typeof(p_update) is distinct from 'object' then
        raise exception 'Billing event could not be matched to a B.O.S. company.';
      end if;
      if exists (select 1 from jsonb_object_keys(p_update) k where k not in (
        'stripe_customer_id','billing_customer_ref','stripe_subscription_id','subscription_ref',
        'stripe_product_id','stripe_price_id','billing_interval','subscription_status',
        'lifecycle_status','current_period_end','cancel_at_period_end','plan_key','seat_limit',
        'orion_text_allowance','orion_voice_minutes','support_tier','payment_method_status',
        'last_payment_at','last_webhook_event_at','updated_at'
      )) then raise exception 'Unsupported billing update field.'; end if;
      select * into v_tenant from public.bos_tenant_accounts
        where company_id = p_company_id for update;
      if not found then raise exception 'Billing company account does not exist.'; end if;
      v_company_id := p_company_id;
      v_patch := jsonb_populate_record(v_tenant, p_update || jsonb_build_object(
        'updated_at', now(), 'last_webhook_event_at', now()));
      update public.bos_tenant_accounts set
        stripe_customer_id=v_patch.stripe_customer_id, billing_customer_ref=v_patch.billing_customer_ref,
        stripe_subscription_id=v_patch.stripe_subscription_id, subscription_ref=v_patch.subscription_ref,
        stripe_product_id=v_patch.stripe_product_id, stripe_price_id=v_patch.stripe_price_id,
        billing_interval=v_patch.billing_interval, subscription_status=v_patch.subscription_status,
        lifecycle_status=v_patch.lifecycle_status, current_period_end=v_patch.current_period_end,
        cancel_at_period_end=v_patch.cancel_at_period_end, plan_key=v_patch.plan_key,
        seat_limit=v_patch.seat_limit, orion_text_allowance=v_patch.orion_text_allowance,
        orion_voice_minutes=v_patch.orion_voice_minutes, support_tier=v_patch.support_tier,
        payment_method_status=v_patch.payment_method_status, last_payment_at=v_patch.last_payment_at,
        last_webhook_event_at=v_patch.last_webhook_event_at, updated_at=v_patch.updated_at
        where company_id = p_company_id;
      if not found then raise exception 'Billing company update did not persist.'; end if;
    end if;
    update public.bos_billing_webhook_events set company_id=v_company_id,
      processing_status=case when v_known then 'processed' else 'ignored' end,
      error_message=null, processed_at=now() where stripe_event_id=v_id;
    return jsonb_build_object('status', case when v_known then 'processed' else 'ignored' end, 'duplicate', false);
  exception when others then
    v_message := left(sqlerrm, 1000);
    update public.bos_billing_webhook_events set company_id=v_company_id,
      processing_status='failed', error_message=v_message, processed_at=now()
      where stripe_event_id=v_id;
    return jsonb_build_object('status','failed','duplicate',false,'error',v_message);
  end;
end;
$$;
revoke all on function public.apply_billing_webhook_event(jsonb,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.apply_billing_webhook_event(jsonb,uuid,jsonb,text) to service_role;
comment on function public.apply_billing_webhook_event(jsonb,uuid,jsonb,text) is
  'Server-only atomic application of verified Stripe events; failed/received retries are recoverable, completed duplicates do not mutate tenants.';
commit;

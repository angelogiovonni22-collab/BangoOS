-- Run after the migration, inside BEGIN ... ROLLBACK. Never commit these fixtures.
-- Isolate worker tests from the later receipt-publisher trigger. The separate
-- atomic-receipt suite exercises their integration. ROLLBACK restores it.
drop trigger if exists z_orion_recorded_receipt_events on public.invoice_payment_history;
drop index if exists public.workflow_events_payment_receipt_once;
create temp table orion_receipt_test_context as
select p.company_id, p.id as user_id, gen_random_uuid() as invoice_id,
       gen_random_uuid() as receipt_id, gen_random_uuid() as event_id,
       gen_random_uuid() as retry_receipt_id, gen_random_uuid() as retry_event_id,
       gen_random_uuid() as dead_event_id, gen_random_uuid() as atomic_event_id,
       gen_random_uuid() as atomic_receipt_id
from public.profiles p join public.company_memberships m
  on m.user_id=p.id and m.company_id=p.company_id and m.status='active'
where m.role='owner' limit 1;

-- Fail completion AFTER notification insertion to prove both effects roll back.
create function pg_temp.orion_test_completion_fault() returns trigger language plpgsql as $$
begin
  if new.status='delivered' and exists(select 1 from pg_temp.orion_receipt_test_context c where c.atomic_event_id=new.event_id) then
    raise exception 'Synthetic completion fault';
  end if;
  return new;
end;
$$;
create trigger orion_test_completion_fault before update on public.orion_event_deliveries
for each row execute function pg_temp.orion_test_completion_fault();

do $$
declare c record; other_member record; cross_event uuid := gen_random_uuid(); n integer; denied boolean;
begin
  select * into strict c from orion_receipt_test_context;
  insert into public.invoices(id,company_id,invoice_number,title,status,total_amount,subtotal,amount_paid,created_by)
  values(c.invoice_id,c.company_id,'WORKER-TEST-'||c.invoice_id,'Transactional worker test only','sent',10,10,0,c.user_id);
  insert into public.invoice_payment_history(id,company_id,invoice_id,amount,payment_date,method,created_by)
  values(c.receipt_id,c.company_id,c.invoice_id,1,current_date,'other',c.user_id);
  insert into public.workflow_events(id,company_id,workflow_name,event_type,reference_entity,reference_id,actor_profile_id)
  values(c.event_id,c.company_id,'worker-test','payment.received','payment',c.receipt_id,c.user_id);
  if not exists(select 1 from public.orion_event_deliveries where event_id=c.event_id and status='pending') then
    raise exception 'Event was not atomically enqueued'; end if;
  perform orion_workers.process_payment_receipts(100);
  if not exists(select 1 from public.orion_event_deliveries where event_id=c.event_id and status='delivered' and attempt_count=1) then
    raise exception 'Initial delivery failed'; end if;
  select count(*) into n from public.bos_notifications where source_key='orion:payment-receipt:'||c.receipt_id;
  if n<>1 then raise exception 'Expected one notification'; end if;
  -- Simulate loss of acknowledgement / explicit replay after the effect committed.
  update public.orion_event_deliveries set status='pending',next_attempt_at=now() where event_id=c.event_id;
  perform orion_workers.process_payment_receipts(100);
  if (select count(*) from public.bos_notifications where source_key='orion:payment-receipt:'||c.receipt_id)<>1 then
    raise exception 'Replay duplicated notification'; end if;
  insert into public.workflow_events(company_id,workflow_name,event_type,reference_entity,reference_id,actor_profile_id)
  values(c.company_id,'worker-test','payment.received','payment',c.receipt_id,c.user_id);
  perform orion_workers.process_payment_receipts(100);
  if (select count(*) from public.bos_notifications where source_key='orion:payment-receipt:'||c.receipt_id)<>1 then
    raise exception 'Duplicate source event duplicated receipt notification'; end if;

  -- A receipt temporarily unavailable to the worker becomes available on retry.
  insert into public.workflow_events(id,company_id,workflow_name,event_type,reference_entity,reference_id,actor_profile_id)
  values(c.retry_event_id,c.company_id,'worker-test','payment.received','payment',c.retry_receipt_id,c.user_id);
  perform orion_workers.process_payment_receipts(100);
  if not exists(select 1 from public.orion_event_deliveries where event_id=c.retry_event_id and status='failed' and attempt_count=1 and next_attempt_at>now()) then
    raise exception 'Failure/backoff was not persisted'; end if;
  perform orion_workers.process_payment_receipts(100);
  if (select attempt_count from public.orion_event_deliveries where event_id=c.retry_event_id)<>1 then
    raise exception 'Retry ignored backoff'; end if;
  insert into public.invoice_payment_history(id,company_id,invoice_id,amount,payment_date,method,created_by)
  values(c.retry_receipt_id,c.company_id,c.invoice_id,1,current_date,'other',c.user_id);
  update public.orion_event_deliveries set next_attempt_at=now() where event_id=c.retry_event_id;
  perform orion_workers.process_payment_receipts(100);
  if not exists(select 1 from public.orion_event_deliveries where event_id=c.retry_event_id and status='delivered' and attempt_count=2 and last_error is null) then
    raise exception 'Failed receipt did not recover'; end if;

  insert into public.workflow_events(id,company_id,workflow_name,event_type,reference_entity,reference_id,actor_profile_id)
  values(c.dead_event_id,c.company_id,'worker-test','payment.received','payment',gen_random_uuid(),c.user_id);
  update public.orion_event_deliveries set attempt_count=4 where event_id=c.dead_event_id;
  perform orion_workers.process_payment_receipts(100);
  if not exists(select 1 from orion_workers.receipt_delivery_health where event_id=c.dead_event_id and needs_attention and next_attempt_at is null) then
    raise exception 'Retry exhaustion was not visible'; end if;
  perform orion_workers.process_payment_receipts(100);
  if (select attempt_count from public.orion_event_deliveries where event_id=c.dead_event_id)<>5 then
    raise exception 'Exhausted delivery retried automatically'; end if;

  insert into public.invoice_payment_history(id,company_id,invoice_id,amount,payment_date,method,created_by)
  values(c.atomic_receipt_id,c.company_id,c.invoice_id,1,current_date,'other',c.user_id);
  insert into public.workflow_events(id,company_id,workflow_name,event_type,reference_entity,reference_id,actor_profile_id)
  values(c.atomic_event_id,c.company_id,'worker-test','payment.received','payment',c.atomic_receipt_id,c.user_id);
  perform orion_workers.process_payment_receipts(100);
  if exists(select 1 from public.bos_notifications where source_key='orion:payment-receipt:'||c.atomic_receipt_id)
     or not exists(select 1 from public.orion_event_deliveries where event_id=c.atomic_event_id and status='failed' and last_error='Synthetic completion fault') then
    raise exception 'Notification escaped failed completion transaction'; end if;
  execute 'drop trigger orion_test_completion_fault on public.orion_event_deliveries';
  update public.orion_event_deliveries set next_attempt_at=now() where event_id=c.atomic_event_id;
  perform orion_workers.process_payment_receipts(100);
  if (select count(*) from public.bos_notifications where source_key='orion:payment-receipt:'||c.atomic_receipt_id)<>1
     or not exists(select 1 from public.orion_event_deliveries where event_id=c.atomic_event_id and status='delivered' and attempt_count=2) then
    raise exception 'Atomic failure did not recover exactly once'; end if;

  select p.company_id,p.id into strict other_member
  from public.profiles p join public.company_memberships m
    on m.company_id=p.company_id and m.user_id=p.id and m.status='active'
  where p.company_id<>c.company_id limit 1;
  insert into public.workflow_events(id,company_id,workflow_name,event_type,reference_entity,reference_id,actor_profile_id)
  values(cross_event,other_member.company_id,'worker-test','payment.received','payment',c.receipt_id,other_member.id);
  perform orion_workers.process_payment_receipts(100);
  if not exists(select 1 from public.orion_event_deliveries where event_id=cross_event and status='failed')
     or exists(select 1 from public.bos_notifications where company_id=other_member.company_id and source_key='orion:payment-receipt:'||c.receipt_id) then
    raise exception 'Cross-company receipt leaked'; end if;

  if has_schema_privilege('anon','orion_workers','usage') or has_schema_privilege('authenticated','orion_workers','usage')
     or has_function_privilege('authenticated','orion_workers.process_payment_receipts(integer)','execute') then
    raise exception 'Browser role can access server worker'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',c.user_id)::text,true);
  denied:=false;
  begin perform public.claim_orion_event_delivery(c.company_id,c.event_id,'server:payment-receipt-inbox:v1');
  exception when others then denied:=sqlerrm='Server-managed Orion delivery'; end;
  if not denied then raise exception 'Browser can claim server delivery'; end if;
  denied:=false;
  begin perform public.complete_orion_event_delivery(c.company_id,c.event_id,'server:payment-receipt-inbox:v1');
  exception when others then denied:=sqlerrm='Server-managed Orion delivery'; end;
  if not denied then raise exception 'Browser can complete server delivery'; end if;
  denied:=false;
  begin perform public.fail_orion_event_delivery(c.company_id,c.event_id,'server:payment-receipt-inbox:v1','fake');
  exception when others then denied:=sqlerrm='Server-managed Orion delivery'; end;
  if not denied then raise exception 'Browser can fail server delivery'; end if;
  denied:=false;
  begin perform orion_workers.process_payment_receipts(101);
  exception when others then denied:=true; end;
  if not denied then raise exception 'Unbounded batch accepted'; end if;
end;
$$;
select 'PASS: enqueue, delivery, replay, receipt deduplication, persisted failure, backoff, recovery, exhaustion, atomic completion rollback, company isolation, browser isolation, reserved-key protection, batch bound' as result;

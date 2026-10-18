-- Execute with the migration inside a transaction, always ROLLBACK.
create temp table receipt_atomic_context as
select p.company_id,p.id user_id,gen_random_uuid() invoice_id,gen_random_uuid() receipt_id,
 gen_random_uuid() pending_id,gen_random_uuid() operation_id,gen_random_uuid() fault_receipt_id
from public.profiles p join public.company_memberships m on m.user_id=p.id and m.company_id=p.company_id
where m.role='owner' and m.status='active' limit 1;
create temp table receipt_atomic_fault(event_type text);
create function pg_temp.receipt_atomic_fault() returns trigger language plpgsql as $$
begin
 if new.payload->>'invoice_id'=(select invoice_id::text from pg_temp.receipt_atomic_context)
    and exists(select 1 from pg_temp.receipt_atomic_fault f where f.event_type=new.event_type) then
   raise exception 'Synthetic atomic event fault';
 end if;
 return new;
end $$;
create trigger receipt_atomic_fault before insert on public.workflow_events
for each row execute function pg_temp.receipt_atomic_fault();

do $$
declare c record; failed boolean; e uuid; result jsonb; returned uuid; n integer;
begin
 select * into strict c from receipt_atomic_context;
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',c.user_id)::text,true);
 insert into public.invoices(id,company_id,invoice_number,title,status,total_amount,subtotal,amount_paid,created_by)
 values(c.invoice_id,c.company_id,'ATOMIC-TEST-'||c.invoice_id,'Transactional atomic receipt test','sent',10,10,0,c.user_id);
 -- Fail first event, then the second event after the payment event/enqueue.
 foreach e in array array[c.fault_receipt_id,gen_random_uuid()] loop
   delete from receipt_atomic_fault;
   insert into receipt_atomic_fault values(case when e=c.fault_receipt_id then 'payment.received' else 'invoice.partial_payment' end);
   failed:=false;
   begin
     perform public.record_invoice_payment_idempotent(c.company_id,c.operation_id,c.invoice_id,
       jsonb_build_object('amount',1,'paymentDate','2026-10-17','method','other'));
   exception when others then failed:=sqlerrm='Synthetic atomic event fault'; end;
   if not failed then raise exception 'Expected injected event failure'; end if;
   if exists(select 1 from public.invoice_payment_history where invoice_id=c.invoice_id)
      or exists(select 1 from public.invoice_payment_operations where operation_id=c.operation_id and company_id=c.company_id)
      or exists(select 1 from public.workflow_events where payload->>'invoice_id'=c.invoice_id::text)
      or (select amount_paid from public.invoices where id=c.invoice_id)<>0 then
     raise exception 'Receipt, operation, event or rollup escaped rollback'; end if;
 end loop;
 delete from receipt_atomic_fault;
 returned:=public.record_invoice_payment_idempotent(c.company_id,c.operation_id,c.invoice_id,
   jsonb_build_object('amount',1,'paymentDate','2026-10-17','method','other'));
 update receipt_atomic_context set receipt_id=returned;
 c.receipt_id:=returned;
 if public.record_invoice_payment_idempotent(c.company_id,c.operation_id,c.invoice_id,
   jsonb_build_object('amount',1,'paymentDate','2026-10-17','method','other'))<>returned then
   raise exception 'Receipt retry changed its identity'; end if;
 if (select count(*) from public.workflow_events where reference_id=returned and event_type='payment.received')<>1
    or (select count(*) from public.workflow_events where payload->>'receipt_id'=returned::text and event_type='invoice.partial_payment')<>1 then
   raise exception 'Canonical events missing or duplicated'; end if;
 select id into strict e from public.workflow_events where reference_id=returned and event_type='payment.received';
 failed:=false;
 begin
   insert into public.workflow_events(company_id,actor_profile_id,workflow_name,event_type,reference_entity,reference_id)
   values(c.company_id,c.user_id,'legacy-client','payment.received','payment',returned);
 exception when unique_violation then failed:=true; end;
 if not failed then raise exception 'Legacy client duplicated canonical receipt event'; end if;
 if not exists(select 1 from public.orion_event_deliveries where event_id=e and status='pending')
    or (select (payload->>'amount_paid')::numeric from public.workflow_events where causation_id=e)<>1 then
   raise exception 'Atomic enqueue or post-rollup balance incorrect'; end if;
 -- No event for pending receipt; exactly one on transition to recorded.
 insert into public.invoice_payment_history(id,company_id,invoice_id,amount,payment_date,method,status,created_by)
 values(c.pending_id,c.company_id,c.invoice_id,1,current_date,'other','pending',c.user_id);
 if exists(select 1 from public.workflow_events where reference_id=c.pending_id) then raise exception 'Pending receipt emitted recorded event'; end if;
 update public.invoice_payment_history set status='recorded' where id=c.pending_id;
 update public.invoice_payment_history set status='recorded' where id=c.pending_id;
 if (select count(*) from public.workflow_events where reference_id=c.pending_id)<>1 then raise exception 'Recorded transition event mismatch'; end if;
 perform orion_workers.process_payment_receipts(25);
 if (select count(*) from public.bos_notifications where source_key='orion:payment-receipt:'||returned)<>1 then
   raise exception 'Automatic receipt delivery missing'; end if;
 -- Model an exhausted delivery after its effect already exists. Requeue must
 -- preserve deduplication, retain evidence and reject a second retry click.
 update public.orion_event_deliveries set status='failed',attempt_count=5,last_error='Synthetic exhausted failure',next_attempt_at=null where event_id=e;
 result:=public.list_orion_receipt_deliveries(c.company_id,0);
 if (result->'summary'->>'needsAttention')::int<>1 then raise exception 'Admin failure summary incorrect'; end if;
 if not public.retry_orion_receipt_delivery(c.company_id,e) then raise exception 'Admin retry rejected'; end if;
 if public.retry_orion_receipt_delivery(c.company_id,e) then raise exception 'Repeated retry accepted'; end if;
 if not exists(select 1 from orion_workers.receipt_retry_requests where event_id=e and requested_by=c.user_id
    and previous_attempt_count=5 and previous_error='Synthetic exhausted failure') then raise exception 'Retry audit missing'; end if;
 perform orion_workers.process_payment_receipts(25);
 if (select count(*) from public.bos_notifications where source_key='orion:payment-receipt:'||returned)<>1 then
   raise exception 'Admin retry duplicated notification'; end if;
 if public.retry_orion_receipt_delivery(c.company_id,e) then raise exception 'Delivered event was requeued'; end if;
 failed:=false;
 begin perform public.list_orion_receipt_deliveries(gen_random_uuid(),0);
 exception when insufficient_privilege then failed:=true; end;
 if not failed then raise exception 'Cross-company monitoring allowed'; end if;
 failed:=false;
 begin perform public.retry_orion_receipt_delivery(gen_random_uuid(),e);
 exception when insufficient_privilege then failed:=true; end;
 if not failed then raise exception 'Cross-company retry allowed'; end if;
 failed:=false;
 begin perform public.list_orion_receipt_deliveries(c.company_id,-1);
 exception when invalid_parameter_value then failed:=true; end;
 if not failed then raise exception 'Invalid pagination accepted'; end if;
 -- Actual authenticated DB role can use only the guarded API.
 execute 'set local role authenticated';
 perform public.list_orion_receipt_deliveries(c.company_id,0);
 execute 'reset role';
 if has_function_privilege('anon','public.list_orion_receipt_deliveries(uuid,integer)','execute')
    or has_function_privilege('anon','public.retry_orion_receipt_delivery(uuid,uuid)','execute')
    or has_schema_privilege('authenticated','orion_workers','usage') then raise exception 'Private monitoring boundary weakened'; end if;
 -- A signed-in nonmember is denied even with authenticated execute privilege.
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid())::text,true);
 failed:=false;
 begin perform public.list_orion_receipt_deliveries(c.company_id,0);
 exception when insufficient_privilege then failed:=true; end;
 if not failed then raise exception 'Nonmember can monitor'; end if;
end $$;
select 'PASS: receipt/event/operation/rollup rollback, canonical replay, pending transition, post-rollup payload, atomic enqueue, delivery, admin monitoring, audited retry, double retry, effect deduplication, role and company isolation, pagination' result;

begin;

-- A still-open older client cannot publish a second receipt event after the
-- database publisher has committed. No historical rows are rewritten.
create unique index workflow_events_payment_receipt_once
on public.workflow_events(company_id,reference_id)
where event_type='payment.received' and reference_entity='payment' and reference_id is not null;

-- Run after the existing receipt rollup trigger (Postgres orders same-kind
-- triggers by name). Event, delivery enqueue and receipt now commit together.
create function orion_workers.publish_recorded_receipt_events()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare i public.invoices%rowtype; payment_event uuid;
begin
  if new.status <> 'recorded' then return new; end if;
  if tg_op='UPDATE' and old.status='recorded' then return new; end if;
  if new.created_by is null or not exists (
    select 1 from public.company_memberships m where m.company_id=new.company_id
      and m.user_id=new.created_by and m.status='active'
  ) then raise exception 'An active payment recorder is required.' using errcode='23514'; end if;
  if auth.uid() is not null and auth.uid()<>new.created_by then
    raise exception 'Payment recorder does not match the authenticated user.' using errcode='42501';
  end if;
  select * into strict i from public.invoices where id=new.invoice_id and company_id=new.company_id;
  insert into public.workflow_events(company_id,actor_profile_id,workflow_name,event_type,
    reference_entity,reference_id,source_module,idempotency_key,payload,metadata)
  values(new.company_id,new.created_by,'accounts_receivable','payment.received','payment',new.id,
    'payments','receipt:'||new.id||':recorded',
    jsonb_build_object('invoice_id',i.id,'invoice_number',i.invoice_number,'amount',new.amount,
      'payment_date',new.payment_date,'method',new.method,
      'resulting_balance',greatest(i.total_amount-i.amount_paid,0),'deep_link','/invoices/'||i.id),
    jsonb_build_object('event_category','finance','event_severity','success','deep_link','/invoices/'||i.id))
  returning id into payment_event;
  insert into public.workflow_events(company_id,actor_profile_id,workflow_name,event_type,
    reference_entity,reference_id,source_module,idempotency_key,causation_id,payload,metadata)
  values(new.company_id,new.created_by,'accounts_receivable',
    case when i.status='paid' then 'invoice.paid' else 'invoice.partial_payment' end,
    'invoice',i.id,'invoices','receipt:'||new.id||':invoice-rollup',payment_event,
    jsonb_build_object('invoice_id',i.id,'receipt_id',new.id,'amount_received',new.amount,
      'amount_paid',i.amount_paid,'balance_due',greatest(i.total_amount-i.amount_paid,0),
      'paid_date',i.paid_date,'payment_date',new.payment_date,'deep_link','/invoices/'||i.id),
    jsonb_build_object('event_category','finance','event_severity','success','deep_link','/invoices/'||i.id));
  return new;
end;
$$;
revoke all on function orion_workers.publish_recorded_receipt_events() from public,anon,authenticated;
create trigger z_orion_recorded_receipt_events after insert or update of status on public.invoice_payment_history
for each row execute function orion_workers.publish_recorded_receipt_events();

-- Keep operational writes private. A narrowly scoped admin RPC is the only
-- browser recovery surface; it never executes the worker or modifies money.
create table orion_workers.receipt_retry_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id uuid not null references public.workflow_events(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  previous_attempt_count integer not null,
  previous_error text,
  requested_at timestamptz not null default now()
);
alter table orion_workers.receipt_retry_requests enable row level security;
revoke all on orion_workers.receipt_retry_requests from public,anon,authenticated;
create index receipt_retry_requests_event_idx on orion_workers.receipt_retry_requests(event_id,company_id);
create index receipt_retry_requests_actor_idx on orion_workers.receipt_retry_requests(requested_by);

create function public.list_orion_receipt_deliveries(p_company_id uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.company_memberships m
    where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active'
      and m.role in ('owner','administrator')) then
    raise exception 'Company administrator access is required.' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_offset>100000 then
    raise exception 'Invalid delivery page.' using errcode='22023'; end if;
  select jsonb_build_object(
    'summary',jsonb_build_object('total',count(*),'pending',count(*) filter(where d.status='pending'),
      'delivered',count(*) filter(where d.status='delivered'),'failed',count(*) filter(where d.status='failed'),
      'needsAttention',count(*) filter(where d.status='failed' and d.attempt_count>=5)),
    'rows',coalesce((select jsonb_agg(to_jsonb(r)) from (
      select x.event_id,x.status,x.attempt_count,x.next_attempt_at,x.last_attempt_at,x.last_error,
        x.delivered_at,x.created_at,e.reference_id as receipt_id,p.invoice_id,i.invoice_number,
        (x.status='failed' and x.attempt_count>=5) as can_retry,
        (select count(*) from orion_workers.receipt_retry_requests a
          where a.company_id=x.company_id and a.event_id=x.event_id) as manual_retry_count
      from public.orion_event_deliveries x
      join public.workflow_events e on e.id=x.event_id and e.company_id=x.company_id
      left join public.invoice_payment_history p on p.id=e.reference_id and p.company_id=x.company_id
      left join public.invoices i on i.id=p.invoice_id and i.company_id=x.company_id
      where x.company_id=p_company_id and x.subscriber_key='server:payment-receipt-inbox:v1'
      order by (x.status='failed' and x.attempt_count>=5) desc,x.created_at desc,x.event_id
      limit 50 offset p_offset
    ) r),'[]'::jsonb)) into result
  from public.orion_event_deliveries d
  where d.company_id=p_company_id and d.subscriber_key='server:payment-receipt-inbox:v1';
  return result;
end;
$$;

create function public.retry_orion_receipt_delivery(p_company_id uuid,p_event_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare d public.orion_event_deliveries%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.company_memberships m
    where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active'
      and m.role in ('owner','administrator')) then
    raise exception 'Company administrator access is required.' using errcode='42501';
  end if;
  select * into d from public.orion_event_deliveries
  where company_id=p_company_id and event_id=p_event_id and subscriber_key='server:payment-receipt-inbox:v1'
  for update;
  if not found or d.status<>'failed' or d.attempt_count<5 then return false; end if;
  insert into orion_workers.receipt_retry_requests(company_id,event_id,requested_by,previous_attempt_count,previous_error)
  values(p_company_id,p_event_id,auth.uid(),d.attempt_count,d.last_error);
  update public.orion_event_deliveries set status='pending',attempt_count=0,next_attempt_at=now(),
    lease_expires_at=null,delivered_at=null,last_error=null,updated_at=now()
  where company_id=p_company_id and event_id=p_event_id and subscriber_key='server:payment-receipt-inbox:v1';
  return true;
end;
$$;
revoke all on function public.list_orion_receipt_deliveries(uuid,integer) from public,anon;
revoke all on function public.retry_orion_receipt_delivery(uuid,uuid) from public,anon;
grant execute on function public.list_orion_receipt_deliveries(uuid,integer) to authenticated;
grant execute on function public.retry_orion_receipt_delivery(uuid,uuid) to authenticated;
commit;

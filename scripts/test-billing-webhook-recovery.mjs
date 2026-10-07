import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.BOS_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const company = '00000000-0000-0000-0000-000000000001';
const missing = '00000000-0000-0000-0000-000000000002';
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create table public.companies(id uuid primary key);
  create table public.bos_tenant_accounts(
    company_id uuid primary key references companies, plan_key text not null default 'starter',
    lifecycle_status text not null default 'active',seat_limit integer not null default 1 check(seat_limit>0),
    orion_text_allowance integer not null default 10,orion_voice_minutes integer not null default 10,
    support_tier text not null default 'standard',onboarding_state jsonb default '{"preserved":true}',
    stripe_customer_id text,billing_customer_ref text,stripe_subscription_id text,subscription_ref text,
    stripe_product_id text,stripe_price_id text,billing_interval text,subscription_status text,
    current_period_end timestamptz,cancel_at_period_end boolean default false,payment_method_status text,
    last_payment_at timestamptz,last_webhook_event_at timestamptz,updated_at timestamptz default now());
  create table public.bos_billing_webhook_events(
    stripe_event_id text primary key,event_type text not null,company_id uuid references companies,
    livemode boolean not null default false,processing_status text not null default 'received'
    check(processing_status in ('received','processed','ignored','failed')),error_message text,
    event_created_at timestamptz,received_at timestamptz default now(),processed_at timestamptz);
  grant usage on schema public to service_role,anon,authenticated;
  grant all on all tables in schema public to service_role;
  alter table bos_tenant_accounts enable row level security;
  alter table bos_billing_webhook_events enable row level security;
  create policy server_tenant on bos_tenant_accounts to service_role using(true) with check(true);
  create policy server_events on bos_billing_webhook_events to service_role using(true) with check(true);
  create function fail_billing_marker() returns trigger language plpgsql as $$begin
    if current_setting('bos.fixture.fail_marker',true)='1' and new.processing_status='processed'
      then raise exception 'Synthetic completion failure'; end if;
    if current_setting('bos.fixture.fail_all',true)='1' then raise exception 'Synthetic marker outage'; end if;
    return new;
  end$$;
  create trigger fixture_marker before update on bos_billing_webhook_events
    for each row execute function fail_billing_marker();
`);
await db.exec(readFileSync('supabase/migrations/20261007014421_audit_billing_webhook_atomic_recovery.sql','utf8'));
await db.query('insert into companies values($1),($2)',[company,missing]);
await db.query('insert into bos_tenant_accounts(company_id) values($1)',[company]);
const event = id => ({id,type:'invoice.payment_failed',livemode:false,created:1791336000,data:{object:{customer:'cus_fixture'}}});
async function apply(e,patch={payment_method_status:'action_required',lifecycle_status:'past_due'},id=company,error=null) {
  await db.exec('set role service_role');
  try { return (await db.query('select apply_billing_webhook_event($1::jsonb,$2::uuid,$3::jsonb,$4::text) as result',
    [JSON.stringify(e),id,JSON.stringify(patch),error])).rows[0].result; }
  finally { await db.exec('reset role'); }
}
const account = async () => (await db.query('select * from bos_tenant_accounts where company_id=$1',[company])).rows[0];
const record = async id => (await db.query('select * from bos_billing_webhook_events where stripe_event_id=$1',[id])).rows[0];

// A late completion failure must roll back the preceding tenant mutation.
await db.exec("set bos.fixture.fail_marker='1'");
assert.equal((await apply(event('evt_late'))).status,'failed');
assert.equal((await account()).lifecycle_status,'active');
assert.equal((await record('evt_late')).processing_status,'failed');
await db.exec("set bos.fixture.fail_marker='0'");
assert.equal((await apply(event('evt_late'))).status,'processed');
assert.equal((await account()).lifecycle_status,'past_due');
assert.equal((await record('evt_late')).processing_attempts,2);
assert.equal((await record('evt_late')).error_message,null);
assert.equal((await record('evt_late')).payload_fingerprint.length,64);
assert.equal((await apply(event('evt_late'),{seat_limit:999})).duplicate,true);
assert.equal((await account()).seat_limit,1);
assert.deepEqual((await account()).onboarding_state,{preserved:true});
assert.equal((await record('evt_late')).processing_attempts,2);
await assert.rejects(apply({...event('evt_late'),data:{object:{customer:'changed'}}}),/different payload/);

// Legacy failed and unfinished records recover rather than being blindly acknowledged.
for (const status of ['failed','received']) {
  const e=event(`evt_legacy_${status}`);
  await db.query('insert into bos_billing_webhook_events(stripe_event_id,event_type,processing_status) values($1,$2,$3)',[e.id,e.type,status]);
  assert.equal((await apply(e)).duplicate,false);
  assert.equal((await record(e.id)).processing_status,'processed');
}
assert.equal((await apply(event('evt_missing'),{},missing)).status,'failed');
assert.equal((await record('evt_missing')).company_id,null);
await db.query('insert into bos_tenant_accounts(company_id) values($1)',[missing]);
assert.equal((await apply(event('evt_missing'),{},missing)).status,'processed');
assert.equal((await apply(event('evt_constraint'),{seat_limit:0})).status,'failed');
assert.equal((await account()).seat_limit,1);
assert.equal((await apply(event('evt_constraint'),{seat_limit:2})).status,'processed');
assert.equal((await account()).seat_limit,2);
assert.equal((await apply(event('evt_lookup'),null,null,'Synthetic lookup failure')).status,'failed');
assert.equal((await apply(event('evt_lookup'))).status,'processed');
assert.equal((await apply(event('evt_bad_field'),{onboarding_state:{} })).status,'failed');
assert.deepEqual((await account()).onboarding_state,{preserved:true});
const ignored={...event('evt_unknown'),type:'unknown.event'};
assert.equal((await apply(ignored,null,null)).status,'ignored');
assert.equal((await apply(ignored,null,null)).duplicate,true);

// If even failure auditing cannot persist, the whole RPC rolls back and retries anew.
const before=await account();
await db.exec("set bos.fixture.fail_all='1'");
await assert.rejects(apply(event('evt_outage')),/Synthetic marker outage/);
await db.exec("set bos.fixture.fail_all='0'");
assert.equal(await record('evt_outage'),undefined);
assert.deepEqual(await account(),before);
assert.equal((await apply(event('evt_outage'))).status,'processed');
for (const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query('select apply_billing_webhook_event($1::jsonb,$2::uuid,$3::jsonb,null)',
    [JSON.stringify(event(`evt_denied_${role}`)),company,'{}']),/permission denied/);
  await db.exec('reset role');
}
console.log('Billing SQL fixture passed: atomic rollback, recoverable failed/received retries, completed duplicate suppression, payload identity, unknown tenant, constraints, missing audit and server-only permissions.');
await db.close();

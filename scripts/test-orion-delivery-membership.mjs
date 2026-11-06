// Actual migration functions in isolated PostgreSQL. No hosted identities or deliveries.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const company='00000000-0000-4000-8000-000000000001', actor='00000000-0000-4000-8000-000000000002', event='00000000-0000-4000-8000-000000000003', other='00000000-0000-4000-8000-000000000004';
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
let checks=0;const check=(v,label)=>{assert.ok(v,label);checks++;};
const claim=async(key='client:test')=>(await query('select claim_orion_event_delivery($1,$2,$3) result',[company,event,key]))[0].result;
const complete=key=>query('select complete_orion_event_delivery($1,$2,$3)',[company,event,key]);
const fail=key=>query('select fail_orion_event_delivery($1,$2,$3,$4)',[company,event,key,'synthetic failure']);
try{
 await db.exec(`create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('role',current_setting('test.role',true))$$;
 create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
 create table profiles(id uuid primary key,company_id uuid);
 create table company_memberships(company_id uuid,user_id uuid,status text);
 create function is_company_member(p_company_id uuid,p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from company_memberships where company_id=p_company_id and user_id=p_user_id and status='active')$$;
 create table workflow_events(id uuid primary key,company_id uuid);
 create table trade_partner_assignments(id uuid primary key,company_id uuid,mobilization_status text,mobilization_blockers jsonb,mobilization_cleared_at timestamptz,updated_at timestamptz);
 create table subcontractor_mobilization_requirements(company_id uuid,assignment_id uuid,requirement_type text,required boolean,status text);
 create table orion_event_deliveries(company_id uuid,event_id uuid,subscriber_key text,status text,updated_at timestamptz,attempt_count integer default 0,last_attempt_at timestamptz,lease_expires_at timestamptz,last_error text,delivered_at timestamptz,primary key(company_id,event_id,subscriber_key));
 insert into profiles values('${actor}','${company}');
 insert into company_memberships values('${company}','${actor}','inactive');
 insert into workflow_events values('${event}','${company}');
 insert into trade_partner_assignments(id,company_id,mobilization_status) values('${event}','${company}','not_cleared');
 select set_config('test.actor','${actor}',false),set_config('test.role','authenticated',false);
 grant usage on schema public,auth to authenticated;`);
 // Optional captured production definitions demonstrate the pre-fix retained-profile gap locally.
 if(process.argv[3]) {
   await db.exec(await readFile(process.argv[3],'utf8'));await db.exec('set role authenticated');
   check(await claim('client:before-fix')==='claimed','pre-fix inactive retained profile could claim');
   await db.exec('reset role');await db.exec('delete from orion_event_deliveries');
 }
 // Apply the migration under test. Calls run as an unprivileged database role.
 await db.exec(await readFile('supabase/migrations/20261106000500_orion_delivery_active_membership.sql','utf8'));
 await db.exec('set role authenticated');
 for(const action of [()=>claim(),()=>complete('client:test'),()=>fail('client:test')]) {await assert.rejects(action(),/Unauthorized/);checks++;}
 await db.exec('reset role');check((await query('select * from orion_event_deliveries')).length===0,'inactive retained profile creates no delivery');
 await query("update company_memberships set status='active'");await db.exec('set role authenticated');
 check(await claim()==='claimed','active member claims');check(await claim()==='leased','in-flight lease is retained');
 check((await query('select mobilization_status from refresh_subcontractor_mobilization_status($1,$2)',[company,event]))[0].mobilization_status==='cleared','active client can refresh derived mobilization');
 await fail('client:test');checks++;check(await claim()==='claimed','failed delivery can be retried');await complete('client:test');checks++;check(await claim()==='delivered','delivered result remains idempotent');
 for(const action of [()=>claim('server:test'),()=>complete('server:test'),()=>fail('server:test')]){await assert.rejects(action(),/Server-managed/);checks++;}
 await db.exec('reset role');
 await query("insert into orion_event_deliveries(company_id,event_id,subscriber_key,status) values($1,$2,'client:pending','processing')",[company,event]);
 for(const status of ['inactive','invited','suspended']){
   await query('update company_memberships set status=$1',[status]);await db.exec('set role authenticated');
   for(const action of [()=>claim('client:new'),()=>complete('client:pending'),()=>fail('client:pending')]){await assert.rejects(action(),/Unauthorized/);checks++;}
   await assert.rejects(query('select * from refresh_subcontractor_mobilization_status($1,$2)',[company,event]),/Unauthorized/);checks++;
   await db.exec('reset role');check((await query("select status from orion_event_deliveries where subscriber_key='client:pending'"))[0].status==='processing',`${status} cannot change pending delivery`);
 }
 await query("update company_memberships set status='active'");await query('update profiles set company_id=$1',[other]);await db.exec('set role authenticated');await assert.rejects(claim(),/Unauthorized/);checks++;await db.exec('reset role');
 await query('update profiles set company_id=null');await db.exec('set role authenticated');await assert.rejects(claim(),/Unauthorized/);checks++;await db.exec('reset role');
 await query('update profiles set company_id=$1',[company]);await db.exec('set role authenticated');
 await assert.rejects(query('select claim_orion_event_delivery($1,$2,$3)',[other,event,'client:foreign']),/Unauthorized/);checks++;
 await assert.rejects(query('select claim_orion_event_delivery($1,$2,$3)',[company,other,'client:missing']),/not found/);checks++;
 await assert.rejects(claim(' '),/Invalid/);checks++;
 await db.exec('reset role');await query("update company_memberships set status='inactive'");await query("select set_config('test.role','service_role',false),set_config('test.actor','',false)");await db.exec('set role authenticated');
 check(await claim('server:worker')==='claimed','service worker retains server delivery access');await complete('server:worker');checks++;check(await claim('server:worker')==='delivered','service worker completion remains idempotent');
 check((await query('select mobilization_status from refresh_subcontractor_mobilization_status($1,$2)',[company,event]))[0].mobilization_status==='cleared','service context can refresh derived mobilization');
 await db.exec('reset role');check((await query("select count(*)::int n from orion_event_deliveries where subscriber_key='client:new'"))[0].n===0,'denied calls never wrote client delivery');
 console.log(`Orion delivery active membership: ${checks} checks passed.`);
}finally{await db.close();}

// Isolated PostgreSQL RLS regression; no hosted credentials or records.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const company='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002', actor='00000000-0000-4000-8000-000000000003';
let checks=0;
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
const check=(v,label)=>{assert.ok(v,label);checks++;};
const asActor=async(operation)=>{await db.exec('set role authenticated');try{return await operation();}finally{await db.exec('reset role');}};
try {
 await db.exec(`create role authenticated; create schema auth; create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select '${actor}'::uuid$$;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 create table company_memberships(company_id uuid,user_id uuid,status text);
 alter table company_memberships enable row level security;
 create policy own_membership on company_memberships for select to authenticated using(user_id=auth.uid());
 create table measurements(id text primary key,company_id uuid,created_by uuid,label text);
 alter table measurements enable row level security;
 create policy measurements_company_select on measurements for select to authenticated using(true);
 create policy measurements_company_insert on measurements for insert to authenticated with check(true);
 create policy measurements_company_update on measurements for update to authenticated using(true) with check(true);
 create policy measurements_company_delete on measurements for delete to authenticated using(true);
 create table storage.objects(id text primary key,bucket_id text,name text);
 alter table storage.objects enable row level security;
 create policy bos_measurements_storage_select on storage.objects for select to authenticated using(true);
 create policy bos_measurements_storage_insert on storage.objects for insert to authenticated with check(true);
 create policy bos_measurements_storage_delete on storage.objects for delete to authenticated using(true);
 grant usage on schema public,auth,storage to authenticated;
 grant select on company_memberships to authenticated;
 grant select,insert,update,delete on measurements,storage.objects to authenticated;
 insert into company_memberships values('${company}','${actor}','active');
 insert into measurements values('seed','${company}','${actor}','synthetic'),('foreign','${other}','${actor}','foreign');
 insert into storage.objects values('seed','bos-measurements','${company}/qa.png'),('foreign','bos-measurements','${other}/qa.png'),('bucket','other','${company}/qa.png');`);
 await db.exec(await readFile('supabase/migrations/20261105235000_measurement_active_membership.sql','utf8'));
 await asActor(async()=>{
   check((await query('select * from measurements')).length===1,'active sees own company only');
   check((await query('select * from storage.objects')).length===1,'active sees own measurement bucket only');
   await query('insert into measurements values($1,$2,$3,$4)',['new',company,actor,'test']);checks++;
   check((await query("update measurements set label='edited' where id='new' returning id")).length===1,'active can update own');
   check((await query("delete from measurements where id='new' returning id")).length===1,'active can delete own');
   await query('insert into storage.objects values($1,$2,$3)',['new','bos-measurements',company+'/new.png']);checks++;
   check((await query("delete from storage.objects where id='new' returning id")).length===1,'active can delete own photo');
   await assert.rejects(query('insert into measurements values($1,$2,$3,$4)',['other',other,actor,'test']));checks++;
   await assert.rejects(query('insert into measurements values($1,$2,$3,$4)',['spoof',company,other,'test']));checks++;
   await assert.rejects(query('insert into storage.objects values($1,$2,$3)',['other','bos-measurements',other+'/new.png']));checks++;
 });
 for(const status of ['inactive','invited','suspended']){
   await query('update company_memberships set status=$1',[status]);
   await asActor(async()=>{
     check((await query('select * from company_memberships')).length===1,`${status} still reads own membership`);
     check((await query('select * from measurements')).length===0,`${status} cannot read records`);
     check((await query('select * from storage.objects')).length===0,`${status} cannot read photos`);
     check((await query("update measurements set label='forbidden' where id='seed' returning id")).length===0,`${status} cannot update records`);
     check((await query("delete from measurements where id='seed' returning id")).length===0,`${status} cannot delete records`);
     check((await query("delete from storage.objects where id='seed' returning id")).length===0,`${status} cannot delete photos`);
     await assert.rejects(query('insert into measurements values($1,$2,$3,$4)',['blocked',company,actor,'test']));checks++;
     await assert.rejects(query('insert into storage.objects values($1,$2,$3)',['blocked','bos-measurements',company+'/blocked.png']));checks++;
   });
 }
 await query("update company_memberships set status='active'");
 await asActor(async()=>{check((await query('select * from measurements')).length===1,'reactivation preserves existing record');check((await query('select * from storage.objects')).length===1,'reactivation preserves existing photo');});
 console.log(`Measurement active-membership RLS: ${checks} checks passed.`);
} finally {await db.close();}

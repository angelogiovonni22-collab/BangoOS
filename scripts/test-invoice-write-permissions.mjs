import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]) throw new Error('Supply the pinned PGlite module path');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const co='00000000-0000-4000-8000-000000000001';
const user='00000000-0000-4000-8000-000000000002';
const invoice='00000000-0000-4000-8000-000000000003';
const other='00000000-0000-4000-8000-000000000004';
const rows=async(sql,values=[]) => (await db.query(sql,values)).rows;
const role=async(value,overrides={},status='active') => {
 await db.exec('reset role');
 await db.query('update public.company_memberships set role=$1,permission_overrides=$2,status=$3',[value,JSON.stringify(overrides),status]);
 await db.exec(`set role authenticated; select set_config('request.jwt.claims','{"sub":"${user}"}',false);`);
};
const insertInvoice=async(company=co) => (await rows("insert into public.invoices(company_id,title,total_amount,status) values($1,'Synthetic role fixture',100,'draft') returning id",[company]))[0].id;
const insertLine=async(id=invoice) => (await rows("insert into public.invoice_line_items(company_id,invoice_id,description) values($1,$2,'Synthetic line') returning id",[co,id]))[0].id;
const insertReceipt=async(id=invoice) => (await rows("insert into public.invoice_payment_history(company_id,invoice_id,amount,payment_date,status) values($1,$2,1,'2026-10-08','recorded') returning id",[co,id]))[0].id;
try {
 await db.exec(`create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
 create table public.companies(id uuid primary key,owner_id uuid);
 create table public.company_memberships(company_id uuid,user_id uuid,role text,status text,permission_overrides jsonb);
 create table public.profiles(id uuid primary key,company_id uuid);
 insert into public.companies values('${co}',gen_random_uuid()),('${other}',gen_random_uuid());
 insert into public.company_memberships values('${co}','${user}','project_manager','active','{}');
 insert into public.profiles values('${user}','${co}');
 create table public.invoices(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,title text not null,total_amount numeric not null,status text not null,amount_paid numeric not null default 0,paid_date date,updated_at timestamptz,unique(id,company_id));
 create table public.invoice_line_items(id uuid primary key default gen_random_uuid(),company_id uuid not null,invoice_id uuid not null,description text,foreign key(invoice_id,company_id) references public.invoices(id,company_id) on delete cascade);
 create table public.invoice_payment_history(id uuid primary key default gen_random_uuid(),company_id uuid not null,invoice_id uuid not null,amount numeric not null,payment_date date,status text not null,foreign key(invoice_id,company_id) references public.invoices(id,company_id) on delete cascade);
 insert into public.invoices(id,company_id,title,total_amount,status) values('${invoice}','${co}','Original synthetic',100,'draft');`);
 const original=await readFile('supabase/migrations/20260815163000_role_department_access_control.sql','utf8');
 const start=original.indexOf('create or replace function public.bos_role_has_permission(');
 const end=original.indexOf('$$;',start)+3;
 assert.ok(start>=0&&end>start);
 await db.exec(original.slice(start,end));
 for (const table of ['invoices','invoice_line_items','invoice_payment_history']) {
  await db.exec(`alter table public.${table} enable row level security;
  create policy fixture_company on public.${table} for all to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.company_id=${table}.company_id)) with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.company_id=${table}.company_id));
  grant select,insert,update,delete on public.${table} to authenticated;`);
  if(table!=='invoices') await db.exec(`create policy fixture_parent on public.${table} as restrictive for all to authenticated using(exists(select 1 from public.invoices i where i.id=${table}.invoice_id and i.company_id=${table}.company_id)) with check(exists(select 1 from public.invoices i where i.id=${table}.invoice_id and i.company_id=${table}.company_id));`);
 }
 await db.exec(`grant select on public.profiles to authenticated;
 create policy bos_role_guard_invoices on public.invoices as restrictive for all to authenticated using(public.bos_role_has_permission(company_id,'invoices.view')) with check(public.bos_role_has_permission(company_id,'invoices.view'));`);
 await db.exec(await readFile('supabase/migrations/20261007230640_audit_invoice_payment_integrity.sql','utf8'));
 await db.exec('create trigger trg_invoice_payment_history_sync_invoice after insert or update or delete on public.invoice_payment_history for each row execute function public.trg_invoice_payment_history_sync_invoice_fn();');
 await role('project_manager');
 assert.equal((await rows("select public.bos_role_has_permission($1,'invoices.manage') allowed",[co]))[0].allowed,false);
 const leaked=await insertInvoice(); await insertLine(leaked); await insertReceipt(leaked);
 assert.equal(Number((await rows('select amount_paid from public.invoices where id=$1',[leaked]))[0].amount_paid),1);
 await rows('delete from public.invoices where id=$1',[leaked]);
 await db.exec('reset role');
 await db.exec(await readFile('supabase/migrations/20261008005840_audit_invoice_write_permissions.sql','utf8'));
 const policies=await rows("select count(*)::int n from pg_policies where policyname like 'bos_audit_invoice_manage_%' and permissive='RESTRICTIVE'");
 assert.equal(policies[0].n,9);
 for(const allowed of ['owner','administrator','office_manager','accountant']) {
  await role(allowed); const id=await insertInvoice(); const line=await insertLine(id); const receipt=await insertReceipt(id);
  assert.equal((await rows("update public.invoice_line_items set description='Corrected' where id=$1 returning id",[line])).length,1);
  assert.equal((await rows('update public.invoice_payment_history set amount=2 where id=$1 returning id',[receipt])).length,1);
  assert.equal(Number((await rows('select amount_paid from public.invoices where id=$1',[id]))[0].amount_paid),2);
  await rows('delete from public.invoice_payment_history where id=$1',[receipt]);
  await rows('delete from public.invoice_line_items where id=$1',[line]);
  assert.equal((await rows("update public.invoices set title='Corrected' where id=$1 returning id",[id])).length,1);
  await rows('delete from public.invoices where id=$1',[id]);
 }
 await role('owner'); const line=await insertLine(); const receipt=await insertReceipt();
 for(const denied of ['operations_manager','project_manager','estimator','superintendent','foreman','employee','subcontractor','customer']) {
  await role(denied);
  const visible=(await rows('select id from public.invoices where id=$1',[invoice])).length;
  assert.equal(visible,['operations_manager','project_manager'].includes(denied)?1:0);
  for(const operation of [insertInvoice,insertLine,insertReceipt]) await assert.rejects(operation(),/row-level security|unavailable/);
  for(const [table,id] of [['invoices',invoice],['invoice_line_items',line],['invoice_payment_history',receipt]]) {
   assert.equal((await rows(`delete from public.${table} where id=$1 returning id`,[id])).length,0);
   const column=table==='invoices'?"title=title":table==='invoice_line_items'?"description=description":"amount=amount";
   assert.equal((await rows(`update public.${table} set ${column} where id=$1 returning id`,[id])).length,0);
  }
 }
 await role('project_manager',{'invoices.manage':true}); const delegated=await insertInvoice(); await insertReceipt(delegated); await rows('delete from public.invoices where id=$1',[delegated]);
 await role('office_manager',{'invoices.manage':false}); await assert.rejects(insertInvoice(),/row-level security/);
 await role('owner',{},'inactive'); await assert.rejects(insertInvoice(),/row-level security/);
 await role('owner'); await assert.rejects(insertInvoice(other),/row-level security/);
 await db.exec("select set_config('request.jwt.claims','{}',false)"); await assert.rejects(insertInvoice(),/row-level security/);
 await db.exec('reset role; set role anon'); await assert.rejects(rows('select * from public.invoices'),/permission denied/);
 await db.exec('reset role'); await rows('delete from public.companies where id=$1',[co]);
 assert.equal((await rows('select count(*)::int n from public.invoices'))[0].n,0);
 assert.equal((await rows('select count(*)::int n from public.invoice_line_items'))[0].n,0);
 assert.equal((await rows('select count(*)::int n from public.invoice_payment_history'))[0].n,0);
 console.log('PASS: view-only receipt/invoice writes reproduced; nine restrictive manage policies; allowed and denied roles, read visibility, overrides, inactive membership, foreign company, missing JWT, anonymous denial, receipt rollup and cascades');
} catch(error) { console.error(error.message,error.code??'',error.where??''); process.exitCode=1; }
finally { await db.close(); }

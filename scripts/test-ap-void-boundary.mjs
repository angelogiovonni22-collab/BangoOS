/** Run against disposable Postgres/WASM: BOS_PGLITE_MODULE=<installed package entry> node scripts/test-ap-void-boundary.mjs */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.BOS_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  create table public.vendor_bills (
    id uuid primary key default gen_random_uuid(), company_id uuid not null,
    status text not null default 'draft', total_amount numeric not null,
    amount_paid numeric not null default 0, voided_at timestamptz, voided_by uuid,
    updated_at timestamptz default now()
  );
  create table public.vendor_bill_payments (
    id uuid primary key default gen_random_uuid(), company_id uuid not null,
    vendor_bill_id uuid not null references public.vendor_bills(id), amount numeric not null check(amount>0)
  );
  grant select,insert,update on public.vendor_bills,public.vendor_bill_payments to authenticated;
`);
const foundation = readFileSync('supabase/migrations/20260818023000_finance_ap_prevailing_wage_foundation.sql','utf8');
const recalculate = foundation.match(/create or replace function public\.recalculate_vendor_bill_payment_totals\(\)[\s\S]*?\$\$;/)[0];
await db.exec(recalculate);
await db.exec(`create trigger recalculate after insert or update or delete on public.vendor_bill_payments for each row execute function public.recalculate_vendor_bill_payment_totals();`);
await db.exec(readFileSync('supabase/migrations/20261006011009_audit_vendor_bill_void_payment_boundary.sql','utf8'));
await db.exec('set role authenticated');
const company = '00000000-0000-0000-0000-000000000001';
const insertBill = async () => (await db.query('insert into public.vendor_bills(company_id,total_amount) values($1,100) returning id',[company])).rows[0].id;
const bill = await insertBill();
const pay = (id, amount) => db.query('insert into public.vendor_bill_payments(company_id,vendor_bill_id,amount) values($1,$2,$3) returning id',[company,id,amount]);
await assert.rejects(pay(bill,10),/Approve the bill/);
await db.query("update public.vendor_bills set status='approved' where id=$1",[bill]);
const payment = (await pay(bill,10)).rows[0].id;
assert.equal((await db.query('select status from public.vendor_bills where id=$1',[bill])).rows[0].status,'partially_paid');
await assert.rejects(pay(bill,91),/exceed bill total/);
await assert.rejects(db.query("update public.vendor_bills set status='voided',amount_paid=0 where id=$1",[bill]),/recorded payments/);
const unpaid = await insertBill();
await assert.rejects(db.query('update public.vendor_bill_payments set vendor_bill_id=$1 where id=$2',[unpaid,payment]),/cannot be moved/);
await db.query("update public.vendor_bills set status='voided' where id=$1",[unpaid]);
const cancelled = (await db.query('select status,voided_at from public.vendor_bills where id=$1',[unpaid])).rows[0];
assert.equal(cancelled.status,'voided'); assert.ok(cancelled.voided_at);
await assert.rejects(pay(unpaid,1),/voided bills/);
await pay(bill,90);
assert.equal((await db.query('select status from public.vendor_bills where id=$1',[bill])).rows[0].status,'paid');
await assert.rejects(pay(bill,1),/Approve the bill/);
await assert.rejects(db.query("update public.vendor_bills set status='voided' where id=$1",[bill]),/recorded payments/);
await db.close();
console.log('AP Postgres boundary passed: unapproved/voided/paid payment rejection, unpaid void, retained history, overpayment and payment reparenting guards under authenticated role');

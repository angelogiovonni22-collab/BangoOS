/** BOS_PGLITE_MODULE=<installed package entry> node scripts/test-procurement-receiving-boundary.mjs */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.BOS_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create table public.purchase_orders(id uuid primary key default gen_random_uuid(), company_id uuid not null, status text not null);
  create table public.materials(id uuid primary key default gen_random_uuid(), company_id uuid not null, status text not null);
  create table public.purchase_order_line_items(
    id uuid primary key default gen_random_uuid(), company_id uuid not null, purchase_order_id uuid not null,
    material_id uuid, quantity_ordered numeric not null default 10, quantity_received numeric not null default 0,
    quantity_damaged numeric not null default 0, quantity_backordered numeric not null default 0, description text default ''
  );
  create table public.purchase_order_receipts(id uuid primary key default gen_random_uuid(), company_id uuid not null, purchase_order_id uuid not null, notes text);
  grant select,insert,update on all tables in schema public to authenticated;
`);
for (const table of ['purchase_orders','materials','purchase_order_line_items','purchase_order_receipts']) {
  await db.exec(`alter table public.${table} enable row level security; create policy company_scope on public.${table} to authenticated using(company_id=current_setting('bos.company')::uuid) with check(company_id=current_setting('bos.company')::uuid);`);
}
await db.exec(readFileSync('supabase/migrations/20261006015313_audit_procurement_receiving_boundary.sql','utf8'));
const company = '00000000-0000-0000-0000-000000000001';
const foreignCompany = '00000000-0000-0000-0000-000000000002';
const foreignOrder = (await db.query("insert into public.purchase_orders(company_id,status) values($1,'issued') returning id",[foreignCompany])).rows[0].id;
const foreignMaterial = (await db.query("insert into public.materials(company_id,status) values($1,'active') returning id",[foreignCompany])).rows[0].id;
await db.exec(`set bos.company='${company}'; set role authenticated;`);
const order = (await db.query("insert into public.purchase_orders(company_id,status) values($1,'draft') returning id",[company])).rows[0].id;
const material = (await db.query("insert into public.materials(company_id,status) values($1,'active') returning id",[company])).rows[0].id;
const line = (await db.query('insert into public.purchase_order_line_items(company_id,purchase_order_id,material_id) values($1,$2,$3) returning id',[company,order,material])).rows[0].id;
const receive = (quantity) => db.query('update public.purchase_order_line_items set quantity_received=$1 where id=$2',[quantity,line]);
const receipt = () => db.query('insert into public.purchase_order_receipts(company_id,purchase_order_id) values($1,$2) returning id',[company,order]);
await assert.rejects(receive(1),/issued purchase order/);
await assert.rejects(receipt(),/issued purchase order/);
await db.query("update public.purchase_orders set status='approved' where id=$1",[order]);
await assert.rejects(receive(1),/issued purchase order/);
await assert.rejects(receipt(),/issued purchase order/);
await db.query("update public.purchase_orders set status='issued' where id=$1",[order]);
await receive(2);
const receiptId = (await receipt()).rows[0].id;
await assert.rejects(receive(11),/cannot exceed/);
await assert.rejects(receive(-1),/non-negative/);
await db.query("update public.materials set status='archived' where id=$1",[material]);
await receive(3); // Catalog retirement does not erase or block a previously issued line's history.
await assert.rejects(db.query('insert into public.purchase_order_line_items(company_id,purchase_order_id,material_id) values($1,$2,$3)',[company,order,material]),/Only active materials/);
await assert.rejects(db.query('insert into public.purchase_order_line_items(company_id,purchase_order_id,material_id) values($1,$2,$3)',[company,order,foreignMaterial]),/Only active materials/);
await assert.rejects(db.query('insert into public.purchase_order_line_items(company_id,purchase_order_id) values($1,$2)',[company,foreignOrder]),/not found in this company/);
await assert.rejects(db.query('update public.purchase_order_line_items set purchase_order_id=$1 where id=$2',[foreignOrder,line]),/cannot be moved/);
await assert.rejects(db.query('update public.purchase_order_receipts set purchase_order_id=$1 where id=$2',[foreignOrder,receiptId]),/cannot be moved/);
for (const status of ['fully_received','cancelled']) {
  await db.query('update public.purchase_orders set status=$1 where id=$2',[status,order]);
  await assert.rejects(receive(4),/issued purchase order/);
  await assert.rejects(receipt(),/issued purchase order/);
}
await db.query("update public.purchase_order_receipts set notes='retained history' where id=$1",[receiptId]);
assert.equal((await db.query('select quantity_received from public.purchase_order_line_items where id=$1',[line])).rows[0].quantity_received,'3');
await db.exec('reset role; set role anon;');
await assert.rejects(db.query('select * from public.purchase_orders'),/permission denied/);
await db.close();
console.log('Procurement Postgres boundary passed: company RLS, active catalog, issued-only receiving, quantity limits, closed-order rejection, retained history and immutable receipt/line parentage under authenticated role');

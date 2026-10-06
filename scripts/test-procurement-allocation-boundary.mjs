/** BOS_PGLITE_MODULE=<installed package entry> node scripts/test-procurement-allocation-boundary.mjs */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.BOS_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create table public.purchase_orders(id uuid primary key default gen_random_uuid(), company_id uuid not null, status text not null);
  create table public.purchase_order_line_items(id uuid primary key default gen_random_uuid(), company_id uuid not null, purchase_order_id uuid not null, material_id uuid, quantity_received numeric not null default 0, unit_cost numeric not null default 2);
  create table public.project_material_allocations(id uuid primary key default gen_random_uuid(), company_id uuid not null, purchase_order_id uuid not null, purchase_order_line_item_id uuid not null, material_id uuid not null, quantity_allocated numeric(14,3) not null, unit_cost numeric(14,4) not null, total_cost numeric(14,2) not null, notes text);
  grant select,insert,update on all tables in schema public to authenticated;
`);
for (const table of ['purchase_orders','purchase_order_line_items','project_material_allocations']) {
  await db.exec(`alter table public.${table} enable row level security; create policy company_scope on public.${table} to authenticated using(company_id=current_setting('bos.company')::uuid) with check(company_id=current_setting('bos.company')::uuid);`);
}
await db.exec(readFileSync('supabase/migrations/20261006132343_audit_procurement_allocation_boundary.sql','utf8'));
const company = '00000000-0000-0000-0000-000000000001';
const otherCompany = '00000000-0000-0000-0000-000000000002';
const material = '00000000-0000-0000-0000-000000000003';
const otherMaterial = '00000000-0000-0000-0000-000000000004';
const foreignOrder = (await db.query("insert into public.purchase_orders(company_id,status) values($1,'issued') returning id",[otherCompany])).rows[0].id;
await db.exec(`set bos.company='${company}'; set role authenticated;`);
const order = (await db.query("insert into public.purchase_orders(company_id,status) values($1,'cancelled') returning id",[company])).rows[0].id;
const line = (await db.query('insert into public.purchase_order_line_items(company_id,purchase_order_id,material_id,quantity_received) values($1,$2,$3,2) returning id',[company,order,material])).rows[0].id;
const allocate = (quantity, options={}) => db.query('insert into public.project_material_allocations(company_id,purchase_order_id,purchase_order_line_item_id,material_id,quantity_allocated,unit_cost,total_cost) values($1,$2,$3,$4,$5,$6,$7) returning id',[company,options.order||order,line,options.material||material,quantity,options.unitCost??2,options.totalCost??quantity*2]);
for (const status of ['draft','approved','cancelled']) {
  await db.query('update public.purchase_orders set status=$1 where id=$2',[status,order]);
  await assert.rejects(allocate(1),/issued purchase order/);
}
await db.query("update public.purchase_orders set status='issued' where id=$1",[order]);
await assert.rejects(allocate(1,{order:foreignOrder}),/not found in this company/);
await assert.rejects(allocate(1,{material:otherMaterial}),/must match/);
await assert.rejects(allocate(1,{unitCost:3,totalCost:3}),/quantity and cost/);
await assert.rejects(allocate(1,{totalCost:1}),/quantity and cost/);
await assert.rejects(allocate(0),/quantity and cost/);
const first = (await allocate(1)).rows[0].id;
await allocate(1);
await assert.rejects(allocate(0.001),/cannot exceed received/);
await assert.rejects(db.query('update public.project_material_allocations set quantity_allocated=2,total_cost=4 where id=$1',[first]),/cannot exceed received/);
await assert.rejects(db.query('update public.project_material_allocations set material_id=$1 where id=$2',[otherMaterial,first]),/cannot be moved/);
await assert.rejects(db.query('update public.purchase_order_line_items set quantity_received=1 where id=$1',[line]),/below allocated/);
await assert.rejects(db.query('update public.purchase_order_line_items set material_id=$1 where id=$2',[otherMaterial,line]),/cannot be replaced/);
await db.query("update public.purchase_orders set status='cancelled' where id=$1",[order]);
await db.query("update public.project_material_allocations set notes='Retained historical notes' where id=$1",[first]);
assert.equal(Number((await db.query('select sum(quantity_allocated) as total from public.project_material_allocations')).rows[0].total),2);
await db.exec('reset role; set role anon;');
await assert.rejects(db.query('select * from public.project_material_allocations'),/permission denied/);
await db.close();
console.log('Authenticated procurement allocation boundary fixtures passed');

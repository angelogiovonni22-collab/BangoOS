import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.BOS_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const company='00000000-0000-0000-0000-000000000001';
const otherCompany='00000000-0000-0000-0000-000000000002';
const user='00000000-0000-0000-0000-000000000003';
const material='00000000-0000-0000-0000-000000000004';
const order='00000000-0000-0000-0000-000000000005';
const line='00000000-0000-0000-0000-000000000006';
const costCode='00000000-0000-0000-0000-000000000007';
const project='00000000-0000-0000-0000-000000000008';
await db.exec(`
  create role anon; create role authenticated; create schema auth;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('bos.actor',true),'')::uuid $$;
  create function public.has_company_role(company uuid,roles text[]) returns boolean language sql as $$
    select company=nullif(current_setting('bos.company',true),'')::uuid and current_setting('bos.membership',true)=any(roles)
  $$;
  grant usage on schema auth to authenticated;
  create table public.companies(id uuid primary key);
  create table public.profiles(id uuid primary key);
  create table public.purchase_orders(id uuid primary key, company_id uuid not null, status text not null, updated_by uuid);
  create table public.purchase_order_line_items(id uuid primary key,company_id uuid not null,purchase_order_id uuid not null,
    material_id uuid, cost_code_id uuid,quantity_ordered numeric(14,3),quantity_received numeric(14,3) default 0,
    quantity_damaged numeric(14,3) default 0,quantity_backordered numeric(14,3) default 0,unit_cost numeric(14,4),updated_by uuid,updated_at timestamptz);
  create table public.materials(id uuid primary key,company_id uuid not null,status text,track_inventory boolean,
    current_stock numeric(14,3),last_purchase_cost numeric(14,4),last_purchase_date date,updated_by uuid);
  create table public.purchase_order_receipts(id uuid primary key default gen_random_uuid(),company_id uuid not null,
    purchase_order_id uuid,received_date date,notes text,received_by uuid,created_by uuid,updated_by uuid);
  create table public.project_material_allocations(id uuid primary key default gen_random_uuid(),company_id uuid not null,
    purchase_order_id uuid,purchase_order_line_item_id uuid,material_id uuid,project_id uuid,cost_code_id uuid,
    quantity_allocated numeric(14,3),unit_cost numeric(14,4),total_cost numeric(14,2),notes text,allocated_by uuid,created_by uuid,updated_by uuid);
  create table public.cost_codes(id uuid primary key,company_id uuid not null,committed_cost numeric(14,2),actual_cost numeric(14,2));
  grant select,insert,update on all tables in schema public to authenticated;
`);
for(const table of ['purchase_orders','purchase_order_line_items','materials','purchase_order_receipts','project_material_allocations','cost_codes']) {
  await db.exec(`alter table public.${table} enable row level security;
    create policy scope on public.${table} to authenticated
    using(company_id=nullif(current_setting('bos.company',true),'')::uuid)
    with check(company_id=nullif(current_setting('bos.company',true),'')::uuid);`);
}
await db.exec(readFileSync('supabase/migrations/20261006015313_audit_procurement_receiving_boundary.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261006132343_audit_procurement_allocation_boundary.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261006135218_audit_procurement_atomic_fulfillment.sql','utf8'));
await db.query('insert into companies values($1),($2)',[company,otherCompany]);
await db.query('insert into profiles values($1)',[user]);
await db.query("insert into materials(id,company_id,status,track_inventory,current_stock) values($1,$2,'active',true,0)",[material,company]);
await db.query("insert into purchase_orders values($1,$2,'issued',null)",[order,company]);
await db.query('insert into purchase_order_line_items(id,company_id,purchase_order_id,material_id,cost_code_id,quantity_ordered,unit_cost) values($1,$2,$3,$4,$5,2.001,2)',[line,company,order,material,costCode]);
await db.query('insert into cost_codes values($1,$2,4,0)',[costCode,company]);
await db.exec(`set bos.actor='${user}'; set bos.company='${company}'; set bos.membership='owner'; set role authenticated;`);
let serial=100;
const operationId=()=>`00000000-0000-0000-0000-${String(serial++).padStart(12,'0')}`;
const receive={purchaseOrderId:order,lineItemId:line,quantityReceived:1.001,quantityDamaged:0,quantityBackordered:0,receivedDate:'2026-10-05',notes:'Synthetic receipt'};
const allocate={purchaseOrderId:order,lineItemId:line,materialId:material,projectId:project,costCodeId:costCode,quantityAllocated:1.001,unitCost:2,notes:null};
const call=(kind,payload,id=operationId(),scope=company)=>db.query('select public.apply_procurement_fulfillment($1,$2,$3,$4::jsonb) as id',[scope,id,kind,JSON.stringify(payload)]);
const state=async()=>({
  line:(await db.query('select quantity_received,quantity_damaged from purchase_order_line_items where id=$1',[line])).rows[0],
  stock:(await db.query('select current_stock,last_purchase_date::text from materials where id=$1',[material])).rows[0],
  status:(await db.query('select status from purchase_orders where id=$1',[order])).rows[0].status,
  cost:(await db.query('select committed_cost,actual_cost from cost_codes where id=$1',[costCode])).rows[0],
  receipts:(await db.query('select count(*)::int n from purchase_order_receipts')).rows[0].n,
  allocations:(await db.query('select count(*)::int n from project_material_allocations')).rows[0].n,
  operations:(await db.query('select count(*)::int n from procurement_fulfillment_operations')).rows[0].n,
});
// Force failure after both the line update and receipt insert.
await db.exec(`reset role;
 create function fail_stock() returns trigger language plpgsql as $$ begin raise exception 'injected stock failure'; end $$;
 create trigger test_fail_stock before update on materials for each row execute function fail_stock(); set role authenticated;`);
const beforeReceipt=await state();
await assert.rejects(call('receive',receive),/injected stock failure/);
assert.deepEqual(await state(),beforeReceipt);
await db.exec('reset role; drop trigger test_fail_stock on materials; set role authenticated;');
const receiptKey=operationId();
const receipt=(await call('receive',receive,receiptKey)).rows[0].id;
const afterReceipt=await state();
assert.equal(afterReceipt.stock.current_stock,'1.001');
assert.equal(afterReceipt.stock.last_purchase_date,'2026-10-05');
assert.equal(afterReceipt.status,'partially_received');
assert.equal(afterReceipt.cost.committed_cost,'2.00');
assert.equal((await call('receive',receive,receiptKey)).rows[0].id,receipt);
assert.deepEqual(await state(),afterReceipt);
await assert.rejects(call('receive',{...receive,quantityReceived:0.5},receiptKey),/original purchasing operation details/);
// Force failure after allocation and stock decrement, during cost recalculation.
await db.exec(`reset role;
 create trigger test_fail_cost before update on cost_codes for each row execute function fail_stock(); set role authenticated;`);
await assert.rejects(call('allocate',allocate),/injected stock failure/);
assert.deepEqual(await state(),afterReceipt);
await db.exec('reset role; drop trigger test_fail_cost on cost_codes; set role authenticated;');
const allocationKey=operationId();
const allocation=(await call('allocate',allocate,allocationKey)).rows[0].id;
const afterAllocation=await state();
assert.equal(afterAllocation.stock.current_stock,'0.000');
assert.equal(afterAllocation.cost.actual_cost,'2.00');
assert.equal((await call('allocate',allocate,allocationKey)).rows[0].id,allocation);
assert.deepEqual(await state(),afterAllocation);
await assert.rejects(call('allocate',{...allocate,quantityAllocated:0.001}),/Insufficient inventory/);
await assert.rejects(call('receive',{...receive,quantityReceived:2}),/within the order/);
await assert.rejects(call('receive',{...receive,quantityReceived:'NaN'}),/finite/);
await assert.rejects(call('receive',receive,operationId(),otherCompany),/Not authorized/);
await db.exec("set bos.membership='employee';");
await assert.rejects(call('receive',receive),/Not authorized/);
await db.exec("set bos.membership='owner';");
const finalKey=operationId();
const finalPayload={...receive,quantityReceived:1};
await call('receive',finalPayload,finalKey);
assert.equal((await state()).status,'fully_received');
const completed=await state();
await call('receive',finalPayload,finalKey);
assert.deepEqual(await state(),completed);
await assert.rejects(call('receive',{...receive,quantityReceived:0.001}),/outstanding quantities/);
await db.exec('reset role; set role anon;');
await assert.rejects(call('receive',receive),/permission denied/);
await db.close();
console.log('Atomic fulfillment rollback, retry, precision, state and role fixtures passed');

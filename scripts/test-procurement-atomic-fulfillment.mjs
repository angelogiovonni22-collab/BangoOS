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
// Extend the same authenticated fixture with draft headers, request conversion,
// actual line-total trigger and project-plan supplier guard.
await db.exec(`reset role;
 create table public.vendors(id uuid primary key,company_id uuid,status text,unique(id,company_id));
 create table public.projects(id uuid primary key,company_id uuid,unique(id,company_id));
 create table public.material_requests(id uuid primary key,company_id uuid,project_id uuid,status text,converted_purchase_order_id uuid,updated_by uuid);
 create table public.project_material_plan_items(id uuid primary key,company_id uuid,project_id uuid,material_id uuid,status text,
   estimated_quantity numeric(14,4),inventory_quantity numeric(14,4),selected_vendor_id uuid,current_unit_cost numeric(14,4),selected_supplier_price_entry_id uuid);
 create table public.supplier_price_entries(id uuid primary key,company_id uuid,vendor_id uuid,material_id uuid,unit_price numeric,contractor_price numeric,match_status text);
 alter table public.purchase_orders add column po_number text,add column request_id uuid,add column vendor_id uuid,add column project_id uuid,
   add column cost_code_id uuid,add column updated_at timestamptz,add column subtotal_amount numeric(14,2) default 0,add column tax_amount numeric(14,2) default 0,
   add column shipping_amount numeric(14,2) default 0,add column total_amount numeric(14,2) default 0,add column notes text,add column attachments jsonb,add column created_by uuid;
 alter table public.purchase_orders add constraint fixture_vendor_scope foreign key(vendor_id,company_id) references public.vendors(id,company_id),
   add constraint fixture_project_scope foreign key(project_id,company_id) references public.projects(id,company_id);
 alter table public.purchase_order_line_items alter column id set default gen_random_uuid(),add column description text,
   add column line_subtotal numeric(14,2),add column project_id uuid,add column project_material_plan_item_id uuid,add column created_by uuid;
 grant select,insert,update on public.vendors,public.projects,public.material_requests,public.project_material_plan_items,public.supplier_price_entries to authenticated;
`);
for(const table of ['vendors','projects','material_requests','project_material_plan_items','supplier_price_entries']) {
  await db.exec(`alter table public.${table} enable row level security;
    create policy scope on public.${table} to authenticated using(company_id=current_setting('bos.company')::uuid)
    with check(company_id=current_setting('bos.company')::uuid);`);
}
await db.exec(readFileSync('supabase/migrations/20260823010000_procurement_purchase_order_totals.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20260827031500_project_material_supplier_po_guard.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261006140120_audit_procurement_atomic_drafts.sql','utf8'));
const vendor='00000000-0000-0000-0000-000000000020';
const request='00000000-0000-0000-0000-000000000021';
const plan='00000000-0000-0000-0000-000000000022';
const price='00000000-0000-0000-0000-000000000023';
await db.query("insert into vendors values($1,$2,'active')",[vendor,company]);
await db.query('insert into projects values($1,$2)',[project,company]);
await db.query("insert into material_requests values($1,$2,$3,'approved',null,null)",[request,company,project]);
await db.query("insert into supplier_price_entries values($1,$2,$3,$4,2,2,'confirmed')",[price,company,vendor,material]);
await db.query("insert into project_material_plan_items values($1,$2,$3,$4,'ready_to_order',3,0,$5,2,$6)",[plan,company,project,material,vendor,price]);
await db.exec('set role authenticated;');
const draftInput={vendorId:vendor,projectId:project,costCodeId:null,taxAmount:0.25,shippingAmount:0.5,notes:'Synthetic atomic draft',requestId:request,attachments:[],
  lines:[{projectMaterialPlanItemId:null,materialId:material,description:'Synthetic line',quantityOrdered:1.111,unitCost:2,projectId:project,costCodeId:null}]};
const draft=(payload,id=operationId())=>db.query('select public.create_procurement_draft($1,$2,$3::jsonb) as id',[company,id,JSON.stringify(payload)]);
const counts=async()=>({orders:(await db.query('select count(*)::int n from purchase_orders')).rows[0].n,
  lines:(await db.query('select count(*)::int n from purchase_order_line_items')).rows[0].n,
  ops:(await db.query('select count(*)::int n from procurement_fulfillment_operations')).rows[0].n});
const beforeDraft=await counts();
await assert.rejects(draft({...draftInput,lines:[...draftInput.lines,{...draftInput.lines[0],quantityOrdered:0}]}),/Every line/);
assert.deepEqual(await counts(),beforeDraft);
assert.equal((await db.query('select status from material_requests where id=$1',[request])).rows[0].status,'approved');
const draftKey=operationId();
const draftId=(await draft(draftInput,draftKey)).rows[0].id;
assert.equal((await db.query('select total_amount from purchase_orders where id=$1',[draftId])).rows[0].total_amount,'2.97');
assert.equal((await db.query('select converted_purchase_order_id from material_requests where id=$1',[request])).rows[0].converted_purchase_order_id,draftId);
const afterDraft=await counts();
assert.equal((await draft(draftInput,draftKey)).rows[0].id,draftId);
assert.deepEqual(await counts(),afterDraft);
await assert.rejects(draft(draftInput),/Only an approved request/);
await assert.rejects(draft({...draftInput,taxAmount:3},draftKey),/original purchasing operation details/);
const planDraft={...draftInput,requestId:null,lines:[{...draftInput.lines[0],projectMaterialPlanItemId:plan,quantityOrdered:2,costCodeId:costCode}]};
const beforePlan=await counts();
await assert.rejects(draft({...planDraft,lines:[{...planDraft.lines[0],materialId:null}]}),/match its project material/);
assert.deepEqual(await counts(),beforePlan);
const planDraftId=(await draft(planDraft)).rows[0].id;
const afterPlan=await counts();
await assert.rejects(draft(planDraft),/exceeds the remaining/);
assert.deepEqual(await counts(),afterPlan);
await db.query('select public.recalculate_procurement_cost_code($1,$2)',[company,costCode]);
assert.equal((await db.query('select committed_cost from cost_codes where id=$1',[costCode])).rows[0].committed_cost,'0.00');
// Order state and purchasing cost changes must commit or roll back together.
await db.exec(`reset role; alter table public.purchase_orders add column approved_at timestamptz,add column approved_by uuid,
 add column issued_at timestamptz,add column issued_by uuid,add column cancelled_at timestamptz,add column cancelled_by uuid;`);
await db.exec(readFileSync('supabase/migrations/20261006143221_audit_procurement_state_transactions.sql','utf8'));
await db.exec('set role authenticated;');
const transition=(action,id=operationId(),target=planDraftId)=>db.query('select public.transition_procurement_order($1,$2,$3,$4) as id',[company,id,target,action]);
const orderState=async()=>(await db.query('select status,approved_by,approved_at,issued_by,issued_at,cancelled_by,cancelled_at from purchase_orders where id=$1',[planDraftId])).rows[0];
await assert.rejects(transition('issue'),/Only approved/);
await db.exec('reset role; create trigger test_fail_state_cost before update on cost_codes for each row execute function fail_stock(); set role authenticated;');
const beforeApproval=await orderState();
const operationsBefore=(await counts()).ops;
await assert.rejects(transition('approve'),/injected stock failure/);
assert.deepEqual(await orderState(),beforeApproval);
assert.equal((await counts()).ops,operationsBefore);
await db.exec('reset role; drop trigger test_fail_state_cost on cost_codes; set role authenticated;');
const approveKey=operationId();
await transition('approve',approveKey);
const approved=await orderState();
assert.equal(approved.status,'approved');
assert.equal(approved.approved_by,user);
assert.ok(approved.approved_at);
assert.equal((await db.query('select committed_cost from cost_codes where id=$1',[costCode])).rows[0].committed_cost,'4.00');
await transition('approve',approveKey);
assert.deepEqual(await orderState(),approved);
await assert.rejects(transition('issue',approveKey),/original purchasing operation details/);
await transition('issue');
const issued=await orderState();
assert.equal(issued.status,'issued');
assert.equal(issued.issued_by,user);
await db.exec('reset role; create trigger test_fail_state_cost before update on cost_codes for each row execute function fail_stock(); set role authenticated;');
await assert.rejects(transition('cancel'),/injected stock failure/);
assert.deepEqual(await orderState(),issued);
await db.exec('reset role; drop trigger test_fail_state_cost on cost_codes; set role authenticated;');
const cancelKey=operationId();
await transition('cancel',cancelKey);
const cancelled=await orderState();
assert.equal(cancelled.status,'cancelled');
assert.equal(cancelled.cancelled_by,user);
assert.ok(cancelled.cancelled_at);
assert.equal((await db.query('select committed_cost from cost_codes where id=$1',[costCode])).rows[0].committed_cost,'0.00');
await transition('cancel',cancelKey);
assert.deepEqual(await orderState(),cancelled);
await assert.rejects(transition('approve'),/Only draft/);
await assert.rejects(transition('cancel',operationId(),order),/Only an open/);
await db.exec("set bos.membership='employee';");
await assert.rejects(transition('approve'),/Not authorized/);
await db.exec("set bos.membership='owner'; reset role;");
await db.exec(readFileSync('supabase/migrations/20261006144816_audit_allocation_inventory_reconciliation.sql','utf8'));
await db.exec('grant delete on public.project_material_allocations to authenticated; set role authenticated;');
// Legacy allocation tracking is deliberately unknown: never guess its stock return.
await assert.rejects(db.query('update project_material_allocations set quantity_allocated=1,total_cost=2 where id=$1',[allocation]),/Legacy allocation inventory/);
await assert.rejects(db.query('delete from project_material_allocations where id=$1',[allocation]),/Legacy allocation inventory/);
const correctionKey=operationId();
const correction=(await call('allocate',{...allocate,quantityAllocated:0.6},correctionKey)).rows[0].id;
const correctionState=async()=>({
  allocation:(await db.query('select quantity_allocated,inventory_quantity_consumed,cost_code_id,total_cost from project_material_allocations where id=$1',[correction])).rows[0],
  stock:(await db.query('select current_stock from materials where id=$1',[material])).rows[0].current_stock,
  cost:(await db.query('select actual_cost from cost_codes where id=$1',[costCode])).rows[0].actual_cost,
});
assert.equal((await correctionState()).stock,'0.400');
assert.equal((await correctionState()).allocation.inventory_quantity_consumed,'0.600');
assert.equal((await correctionState()).cost,'3.20');
// Direct API quantity corrections, not only RPC submissions, return/consume stock.
await db.query('update project_material_allocations set quantity_allocated=0.4,total_cost=0.8,inventory_quantity_consumed=0 where id=$1',[correction]);
assert.equal((await correctionState()).stock,'0.600');
assert.equal((await correctionState()).allocation.inventory_quantity_consumed,'0.400');
assert.equal((await correctionState()).cost,'2.80');
await db.query('update project_material_allocations set quantity_allocated=0.8,total_cost=1.6 where id=$1',[correction]);
assert.equal((await correctionState()).stock,'0.200');
await db.exec('reset role;');
await db.query('update materials set current_stock=0 where id=$1',[material]);
await db.exec('set role authenticated;');
await assert.rejects(db.query('update project_material_allocations set quantity_allocated=0.9,total_cost=1.8 where id=$1',[correction]),/Insufficient inventory/);
assert.equal((await correctionState()).allocation.quantity_allocated,'0.800');
await db.exec('reset role;');
await db.query('update materials set current_stock=0.2 where id=$1',[material]);
await db.exec('set role authenticated;');
const beforeCorrection=await correctionState();
await db.exec('reset role; create trigger test_fail_correction_cost before update on cost_codes for each row execute function fail_stock(); set role authenticated;');
await assert.rejects(db.query('update project_material_allocations set quantity_allocated=0.3,total_cost=0.6 where id=$1',[correction]),/injected stock failure/);
assert.deepEqual(await correctionState(),beforeCorrection);
await assert.rejects(db.query('delete from project_material_allocations where id=$1',[correction]),/injected stock failure/);
assert.deepEqual(await correctionState(),beforeCorrection);
await db.exec('reset role; drop trigger test_fail_correction_cost on cost_codes; set role authenticated;');
// Attribution updates refresh both old and new cost codes without moving stock.
const secondCode='00000000-0000-0000-0000-000000000030';
await db.query('insert into cost_codes values($1,$2,0,0)',[secondCode,company]);
await db.query('update project_material_allocations set cost_code_id=$1 where id=$2',[secondCode,correction]);
assert.equal((await correctionState()).cost,'2.00');
assert.equal((await db.query('select actual_cost from cost_codes where id=$1',[secondCode])).rows[0].actual_cost,'1.60');
assert.equal((await correctionState()).stock,'0.200');
await db.query('delete from project_material_allocations where id=$1',[correction]);
assert.equal((await correctionState()).stock,'1.000');
assert.equal((await db.query('select actual_cost from cost_codes where id=$1',[secondCode])).rows[0].actual_cost,'0.00');
// A delivery retry cannot recreate an allocation intentionally removed later.
await call('allocate',{...allocate,quantityAllocated:0.6},correctionKey);
assert.equal((await correctionState()).allocation,undefined);
// Tracking changes after allocation do not rewrite its recorded inventory effect.
await db.query('update materials set track_inventory=false where id=$1',[material]);
const untracked=(await call('allocate',{...allocate,quantityAllocated:0.5})).rows[0].id;
assert.equal((await correctionState()).stock,'1.000');
await db.query('update materials set track_inventory=true where id=$1',[material]);
await db.query('update project_material_allocations set quantity_allocated=0.3,total_cost=0.6 where id=$1',[untracked]);
assert.equal((await correctionState()).stock,'1.000');
await db.query('delete from project_material_allocations where id=$1',[untracked]);
assert.equal((await correctionState()).stock,'1.000');
const tracked=(await call('allocate',{...allocate,quantityAllocated:0.5})).rows[0].id;
assert.equal((await correctionState()).stock,'0.500');
await db.query('update materials set track_inventory=false where id=$1',[material]);
await db.query('delete from project_material_allocations where id=$1',[tracked]);
assert.equal((await correctionState()).stock,'1.000');
await db.exec('reset role;');
await db.exec(readFileSync('supabase/migrations/20261006145822_audit_procurement_direct_api_boundaries.sql','utf8'));
await db.exec('set role authenticated;');
await assert.rejects(db.query("update purchase_orders set status='draft' where id=$1",[planDraftId]),/Invalid purchase order state/);
await assert.rejects(db.query("update purchase_orders set status='cancelled' where id=$1",[order]),/Invalid purchase order state/);
const directOrder=(await draft(planDraft)).rows[0].id;
const directLine=(await db.query('select id from purchase_order_line_items where purchase_order_id=$1',[directOrder])).rows[0].id;
await assert.rejects(db.query("update purchase_orders set status='issued' where id=$1",[directOrder]),/Invalid purchase order state/);
await assert.rejects(db.query('update purchase_order_line_items set quantity_ordered=3.1,line_subtotal=6.2 where id=$1',[directLine]),/remaining project material requirement/);
await assert.rejects(db.query('update purchase_order_line_items set material_id=null where id=$1',[directLine]),/match its project material requirement/);
await assert.rejects(db.query('update project_material_plan_items set estimated_quantity=1 where id=$1',[plan]),/below its reserved/);
await assert.rejects(db.query('update project_material_plan_items set project_id=$1 where id=$2',[otherCompany,plan]),/cannot be moved/);
await assert.rejects(db.query('insert into purchase_order_line_items(company_id,purchase_order_id,material_id,description,quantity_ordered,unit_cost,line_subtotal,project_id,project_material_plan_item_id) values($1,$2,$3,\'Direct excess line\',1.1,2,2.2,$4,$5)',[company,directOrder,material,project,plan]),/remaining project material requirement/);
// Direct table approval uses the same actor records and atomic commitment updates.
await db.exec('reset role; create trigger test_fail_direct_state_cost before update on cost_codes for each row execute function fail_stock(); set role authenticated;');
await assert.rejects(db.query("update purchase_orders set status='approved' where id=$1",[directOrder]),/injected stock failure/);
assert.equal((await db.query('select status from purchase_orders where id=$1',[directOrder])).rows[0].status,'draft');
await db.exec('reset role; drop trigger test_fail_direct_state_cost on cost_codes; set role authenticated;');
await db.query("update purchase_orders set status='approved',approved_by=$1,issued_by=$1 where id=$2",[otherCompany,directOrder]);
const directApproved=(await db.query('select approved_by,issued_by from purchase_orders where id=$1',[directOrder])).rows[0];
assert.equal(directApproved.approved_by,user);
assert.equal(directApproved.issued_by,null);
assert.equal((await db.query('select committed_cost from cost_codes where id=$1',[costCode])).rows[0].committed_cost,'4.00');
await assert.rejects(db.query('update purchase_order_line_items set quantity_ordered=1 where id=$1',[directLine]),/while the order is a draft/);
await assert.rejects(db.query("update purchase_orders set status='fully_received' where id=$1",[directOrder]),/Invalid purchase order state/);
await transition('issue',operationId(),directOrder);
await assert.rejects(db.query("update purchase_orders set status='fully_received' where id=$1",[directOrder]),/receipt state must match/);
await transition('cancel',operationId(),directOrder);
assert.equal((await db.query('select committed_cost from cost_codes where id=$1',[costCode])).rows[0].committed_cost,'0.00');
// Normal receipt/allocation RPCs still traverse the new direct-API guards.
const guardedOrder=(await draft({...draftInput,requestId:null,lines:[{...draftInput.lines[0],quantityOrdered:0.5,costCodeId:costCode}]})).rows[0].id;
const guardedLine=(await db.query('select id from purchase_order_line_items where purchase_order_id=$1',[guardedOrder])).rows[0].id;
await transition('approve',operationId(),guardedOrder);
await transition('issue',operationId(),guardedOrder);
await db.query('update materials set track_inventory=true where id=$1',[material]);
await call('receive',{...receive,purchaseOrderId:guardedOrder,lineItemId:guardedLine,quantityReceived:0.5});
assert.equal((await db.query('select status from purchase_orders where id=$1',[guardedOrder])).rows[0].status,'fully_received');
await call('allocate',{...allocate,purchaseOrderId:guardedOrder,lineItemId:guardedLine,quantityAllocated:0.5});
assert.equal((await correctionState()).stock,'1.000');
await db.exec('reset role; set role anon;');
await assert.rejects(transition('approve'),/permission denied/);

await assert.rejects(call('receive',receive),/permission denied/);
await assert.rejects(draft(draftInput),/permission denied/);
await db.close();
console.log('Atomic fulfillment and draft/state rollback, retry, precision, request conversion, demand reservation, totals and role fixtures passed');

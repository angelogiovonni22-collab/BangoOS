import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(path,"utf8");

test("subcontractor operations persist change orders, pay applications, and closeout requirements",()=>{
  const sql=read("supabase/migrations/20260828153000_subcontractor_operations_completion.sql");
  assert.match(sql,/subcontractor_change_orders/);
  assert.match(sql,/subcontractor_payment_applications/);
  assert.match(sql,/subcontractor_closeout_requirements/);
  assert.match(sql,/final_lien_waiver/);
  assert.match(sql,/final_certified_payroll/);
  assert.match(sql,/warranty/);
});

test("subcontract change orders preserve executed base terms and become separate commitments",()=>{
  const sql=read("supabase/migrations/20260828153000_subcontractor_operations_completion.sql");
  const commitments=read("components/projects/workspace/project-commitments-control.tsx");
  assert.match(sql,/create_subcontractor_change_order/);
  assert.match(sql,/review_subcontractor_change_order/);
  assert.match(sql,/contract_status not in \('signed','closed'\)/);
  assert.match(commitments,/subcontractor_change_orders/);
  assert.match(commitments,/approvedSubcontractChangeTotal/);
});

test("trade partners can submit bounded payment applications without authorizing payment",()=>{
  const sql=read("supabase/migrations/20260828153000_subcontractor_operations_completion.sql");
  const portal=read("app\/(app)\/partner\/[projectId]\/operations\/page.tsx");
  assert.match(sql,/submit_my_subcontractor_payment_application/);
  assert.match(sql,/Payment application exceeds remaining subcontract commitment/);
  assert.match(sql,/status='draft'/);
  assert.match(sql,/vendor_bills/);
  assert.match(portal,/Submitting does not authorize payment/);
  assert.match(portal,/Submit Payment Application/);
});

test("internal subcontractor operations expose review, AP status, and closeout gating",()=>{
  const component=read("components/projects/workspace/subcontractor-operations-actions.tsx");
  const route=read("app/api/projects/[id]/subcontractors/[assignmentId]/operations/route.ts");
  assert.match(component,/Approve to AP Draft/);
  assert.match(component,/Subcontract Change Orders/);
  assert.match(component,/Payment Applications/);
  assert.match(component,/Closeout Requirements/);
  assert.match(component,/Complete Subcontract Closeout/);
  assert.match(route,/review_subcontractor_payment_application/);
  assert.match(route,/close_subcontractor_assignment/);
});

test("signed subcontractors cannot be archived around closeout controls",()=>{
  const sql=read("supabase/migrations/20260828153000_subcontractor_operations_completion.sql");
  assert.match(sql,/protect_signed_subcontract_archive/);
  assert.match(sql,/Signed subcontractors must complete closeout before archiving/);
  assert.match(sql,/Required subcontractor closeout items are still open/);
  assert.match(sql,/Approved subcontractor bills must be fully paid or resolved before closeout/);
});

test("trade partner portal exposes operations alongside field channels",()=>{
  const portal=read("app\/(app)\/partner\/page.tsx");
  const operations=read("app\/(app)\/partner\/[projectId]\/operations\/page.tsx");
  assert.match(portal,/Operations/);
  assert.match(operations,/Trade Partner Operations/);
  assert.match(operations,/Applications & AP Status/);
  assert.match(operations,/Subcontract Change Orders/);
  assert.match(operations,/Required Handover Items/);
});

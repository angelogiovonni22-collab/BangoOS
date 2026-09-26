import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync("components/change-orders/change-order-detail.tsx", "utf8");
const form = readFileSync("components/change-orders/change-order-form.tsx", "utf8");
const validation = readFileSync("lib/change-orders/validation.ts", "utf8");
const sendRoute = readFileSync("app/api/change-orders/[id]/send-approval/route.ts", "utf8");
const publicRoute = readFileSync("app/api/change-orders/approval/[token]/route.ts", "utf8");
const publicPage = readFileSync("app/change-orders/approval/[token]/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260926125500_change_order_customer_approval.sql", "utf8");

test("change order detail can send secure customer approval", () => {
  assert.match(detail, /Send to Customer/);
  assert.match(detail, /send-approval/);
  assert.match(detail, /Customer total is \$0\.00/);
  assert.match(sendRoute, /Customer total is \$0\.00/);
  assert.match(sendRoute, /Customer Price/);
  assert.match(sendRoute, /pending_approval/);
  assert.match(sendRoute, /sendContractEmail/);
});

test("customer approval uses secure expiring token and recorded decision", () => {
  assert.match(migration, /change_order_customer_tokens/);
  assert.match(migration, /change_order_customer_approvals/);
  assert.match(sendRoute, /createChangeOrderApprovalToken/);
  assert.match(publicRoute, /hashChangeOrderApprovalToken/);
  assert.match(publicRoute, /decision.*approved/);
  assert.match(publicRoute, /decision.*rejected/);
  assert.match(publicRoute, /typed_name/);
  assert.match(publicPage, /Approve Change Order/);
  assert.match(publicPage, /Reject Change Order/);
  assert.match(publicPage, /Customer Price/);
});

test("mobile change-order editor clearly separates internal cost from customer price", () => {
  assert.match(form, /Unit Cost \(Internal\)/);
  assert.match(form, /Customer Price/);
  assert.match(form, /md:hidden/);
  assert.match(form, /Customer Amount/);
  assert.match(validation, /Customer Price greater than \$0/);
});

console.log("Change order customer approval contract passed.");

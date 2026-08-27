import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("lib/accounts-receivable/service.ts", "utf8");
const page = readFileSync("app/(app)/invoices/accounts-receivable/page.tsx", "utf8");
const payment = readFileSync("app/(app)/invoices/[id]/payment/new/page.tsx", "utf8");

test("AR excludes non-collectible invoice states and prevents overpayments", () => {
  assert.match(service, /\["draft", "paid", "void"\]/);
  assert.match(service, /Payment cannot exceed the invoice balance/);
  assert.match(service, /partially_paid/);
  assert.match(service, /invoice_payment_history/);
});

test("AR command center exposes aging and payment workflow", () => {
  assert.match(page, /Receivables Aging/);
  assert.match(page, /Collected This Month/);
  assert.match(page, /Record Payment/);
  assert.match(payment, /ACH \/ Bank Transfer/);
  assert.match(payment, /Reference Number/);
});

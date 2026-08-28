import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("lib/accounts-receivable/service.ts", "utf8");
const page = readFileSync("app/(app)/invoices/accounts-receivable/page.tsx", "utf8");
const payment = readFileSync("app/(app)/invoices/[id]/payment/new/page.tsx", "utf8");
const invoices = readFileSync("app/(app)/invoices/page.tsx", "utf8");

test("accounts receivable excludes non-collectible states and calculates standard aging buckets", () => {
  assert.match(service, /\["draft", "paid", "void"\]/);
  assert.match(service, /"1-30"/);
  assert.match(service, /"31-60"/);
  assert.match(service, /"61-90"/);
  assert.match(service, /"90\+"/);
  assert.match(service, /balanceDue > 0/);
});

test("customer payment recording preserves compliance and balance safety boundaries", () => {
  assert.match(service, /authorizeInvoicePaymentCollection/);
  assert.match(service, /Payment cannot exceed the invoice balance/);
  assert.match(service, /\.eq\("amount_paid", alreadyPaid\)/);
  assert.match(service, /invoice_payment_history/);
  assert.match(service, /partially_paid/);
  assert.match(service, /payment\.received/);
  assert.match(service, /invoice\.paid/);
});

test("accounts receivable command center exposes aging and controlled payment workflow", () => {
  assert.match(page, /Receivables Aging/);
  assert.match(page, /Collected This Month/);
  assert.match(page, /Open Customer Balances/);
  assert.match(page, /Record Payment/);
  assert.match(payment, /ACH \/ Bank Transfer/);
  assert.match(payment, /Reference Number/);
  assert.match(invoices, /Accounts Receivable/);
  assert.match(invoices, /\/invoices\/accounts-receivable/);
});

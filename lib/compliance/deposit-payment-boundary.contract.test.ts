import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const enforcementSql = readFileSync(new URL("../../supabase/migrations/20260814151000_enforce_deposit_payment_compliance.sql", import.meta.url), "utf8");
const calculationSql = readFileSync(new URL("../../supabase/migrations/20260814152000_compliant_estimate_deposit_calculation.sql", import.meta.url), "utf8");
const evidenceSql = readFileSync(new URL("../../supabase/migrations/20260814150000_invoice_payment_compliance.sql", import.meta.url), "utf8");
const invoiceService = readFileSync(new URL("../invoices/service.ts", import.meta.url), "utf8");
const estimateWorkflow = readFileSync(new URL("../estimates/workflow-service.ts", import.meta.url), "utf8");

test("workflow deposit invoices are explicitly classified", () => {
  assert.match(estimateWorkflow, /kind:\s*"deposit"/);
  assert.match(enforcementSql, /metadata->>'kind'.*'deposit'/s);
});

test("payment history is guarded before its existing invoice balance sync", () => {
  assert.match(enforcementSql, /before insert or update of amount, status on public\.invoice_payment_history/i);
  assert.match(invoiceService, /\.from\("invoice_payment_history"\)\s*\.insert/s);
  assert.match(enforcementSql, /v_prospective > v_maximum/);
});

test("deposit creation uses a compliant capped calculation", () => {
  assert.match(calculationSql, /create or replace function public\.calculate_estimate_deposit/);
  assert.match(calculationSql, /v_ordinary_limit := round\(v_contract_amount \* 0\.10, 2\)/);
  assert.match(calculationSql, /v_special_limit := round\(greatest\(coalesce\(v_special_order_amount, 0\), 0\) \* 0\.75, 2\)/);
  assert.match(calculationSql, /return round\(least\(greatest\(v_requested, 0\), v_maximum\), 2\)/);
});

test("cost-plus and construction-loan treatment cannot be confused with ordinary deposit collection", () => {
  assert.match(calculationSql, /v_pricing_type.*cost_plus/s);
  assert.match(enforcementSql, /payment_source'.*construction_loan/s);
});

test("payment compliance evidence is append-only", () => {
  assert.match(evidenceSql, /create table if not exists public\.invoice_payment_compliance_evaluations/);
  assert.match(evidenceSql, /for select/);
  assert.match(evidenceSql, /for insert/);
  assert.doesNotMatch(evidenceSql, /for update/);
  assert.doesNotMatch(evidenceSql, /for delete/);
});

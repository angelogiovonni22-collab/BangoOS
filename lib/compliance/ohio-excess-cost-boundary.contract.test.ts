import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260814160000_ohio_change_order_excess_cost_compliance.sql", import.meta.url),
  "utf8",
);

test("Phase 5 evidence is append-only", () => {
  assert.match(sql, /create table if not exists public\.change_order_excess_cost_compliance_evaluations/);
  assert.match(sql, /for select/);
  assert.match(sql, /for insert/);
  assert.doesNotMatch(sql, /for update\s+to authenticated/i);
  assert.doesNotMatch(sql, /for delete\s+to authenticated/i);
});

test("the statutory threshold is cumulative across change orders tied to the contract estimate", () => {
  assert.match(sql, /co\.estimate_id = v_co\.estimate_id/);
  assert.match(sql, /sum\(co\.total_amount\)/);
  assert.match(sql, /v_cumulative > 5000/);
  assert.match(sql, /qualifies_as_unforeseen_necessary is true/);
});

test("work-start and charge gates are independent", () => {
  assert.match(sql, /assert_change_order_excess_cost_work_may_start/);
  assert.match(sql, /assert_change_order_excess_cost_charge_allowed/);
  assert.match(sql, /workMayStart/);
  assert.match(sql, /chargeMayProceed/);
});

test("contract-selected written or oral estimate evidence is enforced", () => {
  assert.match(sql, /v_profile\.excess_cost_method in \('written','oral'\)/);
  assert.match(sql, /v_latest\.estimate_method = v_profile\.excess_cost_method/);
  assert.match(sql, /v_latest\.estimate_provided_at is not null/);
});

test("owner approval is checked separately from internal change-order approval", () => {
  assert.match(sql, /v_latest\.owner_approved is true/);
  assert.match(sql, /v_latest\.owner_approved_at is not null/);
  assert.doesNotMatch(sql, /v_co\.approved_by.*owner_approved/);
});

test("both change-order invoice links and direct invoiced status transitions are hard-gated", () => {
  assert.match(sql, /before insert or update of change_order_id, amount_applied on public\.change_order_invoice_links/i);
  assert.match(sql, /before update of status on public\.change_orders/i);
  assert.match(sql, /perform public\.assert_change_order_excess_cost_charge_allowed\(new\.change_order_id\)/);
  assert.match(sql, /perform public\.assert_change_order_excess_cost_charge_allowed\(new\.id\)/);
});

test("cost-plus and firm-price/no-excess configurations retain their distinct treatment", () => {
  assert.match(sql, /v_profile\.pricing_type = 'cost_plus'/);
  assert.match(sql, /v_profile\.excess_cost_method = 'firm_price_no_excess'/);
});

test("unresolved covered Ohio classification fails closed", () => {
  assert.match(sql, /Classify this change order and capture excess-cost compliance evidence before work or charging proceeds/);
  assert.match(sql, /Classify whether the change is reasonably unforeseen but necessary/);
});

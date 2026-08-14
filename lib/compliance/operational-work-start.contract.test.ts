import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260814170000_operational_work_start_compliance.sql", import.meta.url),
  "utf8",
);
const service = readFileSync(new URL("./operational-work-start-service.ts", import.meta.url), "utf8");

test("Phase 6 composes existing legal guards instead of duplicating their rules", () => {
  assert.match(sql, /perform public\.assert_estimate_work_may_begin\(p_company_id, p_estimate_id\)/);
  assert.match(sql, /perform public\.assert_estimate_work_may_begin\(p_company_id, v_estimate_id\)/);
  assert.match(sql, /perform public\.assert_change_order_excess_cost_work_may_start\(p_change_order_id\)/);
});

test("change-order work fails closed when the governing estimate cannot be identified", () => {
  assert.match(sql, /if v_estimate_id is null then/);
  assert.match(sql, /raise exception 'GOVERNING_ESTIMATE_REQUIRED'/);
});

test("a governing estimate must belong to the requesting company", () => {
  assert.match(sql, /v_estimate_company <> p_company_id/);
  assert.match(sql, /GOVERNING_ESTIMATE_NOT_FOUND/);
});

test("operational decisions preserve known compliance blocker codes", () => {
  assert.match(sql, /HOME_SOLICITATION_CANCELLATION_HOLD/);
  assert.match(sql, /CONTRACT_CANCELLED/);
  assert.match(sql, /CHANGE_ORDER_EXCESS_COST_BLOCKED/);
  assert.match(sql, /COMPLIANCE_REVIEW_REQUIRED/);
});

test("authorization evidence is append-only", () => {
  assert.match(sql, /create table if not exists public\.operational_work_start_authorizations/);
  assert.match(sql, /for select/);
  assert.match(sql, /for insert/);
  assert.doesNotMatch(sql, /for update\s+to authenticated/i);
  assert.doesNotMatch(sql, /for delete\s+to authenticated/i);
});

test("UI API and Orion can converge on one shared authorization service", () => {
  assert.match(service, /get_operational_work_start_decision/);
  assert.match(service, /authorizeOperationalWorkStart/);
  assert.match(service, /recordOperationalWorkStartDecision/);
  assert.match(service, /operational_work_start_authorizations"\)\.insert/);
});

test("blocked decisions are recorded before the service throws", () => {
  const recordIndex = service.indexOf("await recordOperationalWorkStartDecision");
  const throwIndex = service.indexOf("throw new OperationalWorkStartBlockedError");
  assert.ok(recordIndex >= 0);
  assert.ok(throwIndex >= 0);
  assert.ok(recordIndex < throwIndex);
});

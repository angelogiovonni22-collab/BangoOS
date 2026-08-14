import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const service = readFileSync(new URL("./change-order-excess-cost-service.ts", import.meta.url), "utf8");

test("Phase 5 records a new immutable evidence snapshot rather than mutating prior evidence", () => {
  assert.match(service, /from\("change_order_excess_cost_compliance_evaluations"\)\.insert/);
  assert.doesNotMatch(service, /change_order_excess_cost_compliance_evaluations"\)\.update/);
  assert.doesNotMatch(service, /change_order_excess_cost_compliance_evaluations"\)\.delete/);
});

test("service computes cumulative qualifying excess from the same source contract estimate", () => {
  assert.match(service, /\.eq\("estimate_id", estimateId\)/);
  assert.match(service, /latestClassification\.get\(id\) !== true/);
  assert.match(service, /priorQualifyingExcessCostCents/);
});

test("work-start and charge authorization remain separate operations", () => {
  assert.match(service, /authorizeChangeOrderWorkStart/);
  assert.match(service, /if \(!evaluation\.workMayStart\)/);
  assert.match(service, /authorizeChangeOrderCharge/);
  assert.match(service, /if \(!evaluation\.chargeMayProceed\)/);
});

test("owner approval evidence is not sourced from the internal approved_by field", () => {
  assert.match(service, /owner_approved: input\.ownerApprovalEvidence\?\.approved === true/);
  assert.doesNotMatch(service, /approved_by/);
});

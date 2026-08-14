import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { evaluateOhioExcessCostCompliance } from "./ohio-excess-cost-compliance";

const refinementSql = readFileSync(
  new URL("../../supabase/migrations/20260814161000_refine_ohio_excess_cost_scope.sql", import.meta.url),
  "utf8",
);

test("firm-price/no-excess does not reclassify an ordinary owner-requested change, while owner approval still gates the charge", () => {
  const result = evaluateOhioExcessCostCompliance({
    applicable: true,
    pricingType: "fixed",
    contractEstimateMethod: "firm_price_no_excess",
    qualifiesAsReasonablyUnforeseenNecessary: false,
    currentExcessCostCents: 250_000,
    priorQualifyingExcessCostCents: 0,
    ownerApprovalEvidence: { approved: true, approvedAt: "2026-08-14T12:05:00Z", method: "portal" },
  });

  assert.equal(result.status, "COMPLIANT");
  assert.equal(result.estimateNoticeRequired, false);
  assert.equal(result.ownerApprovalRequiredBeforeCharge, true);
  assert.equal(result.chargeMayProceed, true);
  assert.equal(result.cumulativeQualifyingExcessCostCents, 0);
});

test("database refinement performs statutory classification before firm-price/no-excess handling", () => {
  const classificationIndex = refinementSql.indexOf("qualifies_as_unforeseen_necessary is false");
  const firmPriceIndex = refinementSql.indexOf("excess_cost_method = 'firm_price_no_excess'");

  assert.ok(classificationIndex >= 0);
  assert.ok(firmPriceIndex >= 0);
  assert.ok(classificationIndex < firmPriceIndex);
  assert.match(refinementSql, /owner approval is required before charging the excess cost/i);
});

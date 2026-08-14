import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateOhioExcessCostCompliance,
  OHIO_EXCESS_COST_NOTICE_THRESHOLD_CENTS,
} from "./ohio-excess-cost-compliance";

const base = {
  applicable: true as const,
  pricingType: "estimated" as const,
  contractEstimateMethod: "written" as const,
  qualifiesAsReasonablyUnforeseenNecessary: true as const,
  currentExcessCostCents: 100_000,
  priorQualifyingExcessCostCents: 0,
  estimateEvidence: null,
  ownerApprovalEvidence: null,
};

test("the estimate notice threshold is strictly greater than $5,000 cumulative", () => {
  const below = evaluateOhioExcessCostCompliance({ ...base, currentExcessCostCents: OHIO_EXCESS_COST_NOTICE_THRESHOLD_CENTS - 1 });
  const exact = evaluateOhioExcessCostCompliance({ ...base, currentExcessCostCents: OHIO_EXCESS_COST_NOTICE_THRESHOLD_CENTS });
  const above = evaluateOhioExcessCostCompliance({ ...base, currentExcessCostCents: OHIO_EXCESS_COST_NOTICE_THRESHOLD_CENTS + 1 });

  assert.equal(below.estimateNoticeRequired, false);
  assert.equal(exact.estimateNoticeRequired, false);
  assert.equal(above.estimateNoticeRequired, true);
});

test("smaller changes accumulate across the contract before the notice trigger", () => {
  const result = evaluateOhioExcessCostCompliance({ ...base, priorQualifyingExcessCostCents: 450_000, currentExcessCostCents: 50_001 });
  assert.equal(result.cumulativeQualifyingExcessCostCents, 500_001);
  assert.equal(result.estimateNoticeRequired, true);
  assert.equal(result.workMayStart, false);
});

test("the owner-selected estimate method must match before covered work starts", () => {
  const wrongMethod = evaluateOhioExcessCostCompliance({
    ...base,
    currentExcessCostCents: 500_001,
    estimateEvidence: { method: "oral", providedAt: "2026-08-14T12:00:00Z", amountCents: 500_001 },
    ownerApprovalEvidence: { approved: true, approvedAt: "2026-08-14T12:01:00Z", method: "written" },
  });
  const correctMethod = evaluateOhioExcessCostCompliance({
    ...base,
    currentExcessCostCents: 500_001,
    estimateEvidence: { method: "written", providedAt: "2026-08-14T12:00:00Z", amountCents: 500_001 },
    ownerApprovalEvidence: { approved: true, approvedAt: "2026-08-14T12:01:00Z", method: "written" },
  });
  assert.equal(wrongMethod.workMayStart, false);
  assert.equal(correctMethod.workMayStart, true);
});

test("owner approval is independently required before charging a qualifying excess cost", () => {
  const result = evaluateOhioExcessCostCompliance({ ...base, currentExcessCostCents: 100_000 });
  assert.equal(result.estimateNoticeRequired, false);
  assert.equal(result.workMayStart, true);
  assert.equal(result.ownerApprovalRequiredBeforeCharge, true);
  assert.equal(result.chargeMayProceed, false);
});

test("cost-plus contracts are exempt from the evaluated Chapter 4722 excess-cost gates", () => {
  const result = evaluateOhioExcessCostCompliance({ ...base, pricingType: "cost_plus", currentExcessCostCents: 2_000_000 });
  assert.equal(result.exemptReason, "cost_plus");
  assert.equal(result.workMayStart, true);
  assert.equal(result.chargeMayProceed, true);
});

test("firm-price/no-excess contracts cannot be used to charge a qualifying excess amount", () => {
  const result = evaluateOhioExcessCostCompliance({ ...base, contractEstimateMethod: "firm_price_no_excess", currentExcessCostCents: 1 });
  assert.equal(result.status, "ACTION_REQUIRED");
  assert.equal(result.chargeMayProceed, false);
});

test("unresolved classification fails closed for work and charging", () => {
  const result = evaluateOhioExcessCostCompliance({ ...base, qualifiesAsReasonablyUnforeseenNecessary: null });
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(result.workMayStart, false);
  assert.equal(result.chargeMayProceed, false);
});

test("a non-qualifying change does not inflate the statutory cumulative amount but still needs owner approval before charge", () => {
  const pending = evaluateOhioExcessCostCompliance({
    ...base,
    qualifiesAsReasonablyUnforeseenNecessary: false,
    priorQualifyingExcessCostCents: 400_000,
    currentExcessCostCents: 300_000,
  });
  const approved = evaluateOhioExcessCostCompliance({
    ...base,
    qualifiesAsReasonablyUnforeseenNecessary: false,
    priorQualifyingExcessCostCents: 400_000,
    currentExcessCostCents: 300_000,
    ownerApprovalEvidence: { approved: true, approvedAt: "2026-08-14T12:02:00Z", method: "portal" },
  });

  assert.equal(pending.cumulativeQualifyingExcessCostCents, 400_000);
  assert.equal(pending.estimateNoticeRequired, false);
  assert.equal(pending.workMayStart, true);
  assert.equal(pending.chargeMayProceed, false);
  assert.equal(approved.chargeMayProceed, true);
});

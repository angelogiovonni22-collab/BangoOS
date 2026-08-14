import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOhioDepositCompliance } from "./ohio-deposit-compliance";

const base = {
  contractAmount: 40_000,
  requestedDepositAmount: 4_000,
  priorPrePerformancePayments: 0,
  homeConstructionApplicable: true as const,
  pricingType: "fixed" as const,
  specialOrderAmount: 0,
  specialOrderNonreturnable: false,
  constructionLoanPayment: false,
  prePerformance: true as const,
};

test("covered ordinary down payment at ten percent passes", () => {
  const result = evaluateOhioDepositCompliance(base);
  assert.equal(result.status, "COMPLIANT");
  assert.equal(result.ordinaryLimit, 4_000);
  assert.equal(result.conservativeMaximumPrePerformancePayment, 4_000);
});

test("covered ordinary down payment above ten percent is blocked", () => {
  const result = evaluateOhioDepositCompliance({ ...base, requestedDepositAmount: 4_000.01 });
  assert.equal(result.status, "ACTION_REQUIRED");
});

test("qualifying nonreturnable special order uses seventy-five percent ceiling", () => {
  const pass = evaluateOhioDepositCompliance({ ...base, requestedDepositAmount: 7_500, specialOrderAmount: 10_000, specialOrderNonreturnable: true });
  const fail = evaluateOhioDepositCompliance({ ...base, requestedDepositAmount: 7_500.01, specialOrderAmount: 10_000, specialOrderNonreturnable: true });
  assert.equal(pass.status, "COMPLIANT");
  assert.equal(pass.qualifyingSpecialOrderLimit, 7_500);
  assert.equal(fail.status, "ACTION_REQUIRED");
});

test("special order without nonreturnable qualification does not expand ceiling", () => {
  const result = evaluateOhioDepositCompliance({ ...base, requestedDepositAmount: 5_000, specialOrderAmount: 10_000, specialOrderNonreturnable: false });
  assert.equal(result.status, "ACTION_REQUIRED");
});

test("prior pre-performance payments count toward the ceiling", () => {
  const result = evaluateOhioDepositCompliance({ ...base, requestedDepositAmount: 2_500, priorPrePerformancePayments: 2_000 });
  assert.equal(result.status, "ACTION_REQUIRED");
  assert.equal(result.prospectivePrePerformancePayments, 4_500);
});

test("cost-plus contracts are outside ORC 4722.04", () => {
  const result = evaluateOhioDepositCompliance({ ...base, requestedDepositAmount: 20_000, pricingType: "cost_plus" });
  assert.equal(result.status, "NOT_APPLICABLE");
});

test("construction-loan payments are separately permitted", () => {
  const result = evaluateOhioDepositCompliance({ ...base, requestedDepositAmount: 20_000, constructionLoanPayment: true });
  assert.equal(result.status, "NOT_APPLICABLE");
});

test("unknown applicability or timing requires review instead of guessing", () => {
  assert.equal(evaluateOhioDepositCompliance({ ...base, homeConstructionApplicable: null }).status, "REVIEW_REQUIRED");
  assert.equal(evaluateOhioDepositCompliance({ ...base, prePerformance: null }).status, "REVIEW_REQUIRED");
});

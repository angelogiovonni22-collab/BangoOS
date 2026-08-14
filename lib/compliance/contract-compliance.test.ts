import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOhioResidentialContract, type OhioResidentialContractInput } from "./contract-compliance";

function covered(overrides: Partial<OhioResidentialContractInput> = {}): OhioResidentialContractInput {
  return {
    totalAmount: 40_000,
    propertyState: "OH",
    propertyClass: "one_to_three_family",
    pricingType: "fixed",
    supplierName: "Bango Construction LLC",
    supplierPhysicalAddress: "123 Business St, Marysville, OH 43040",
    supplierPhone: "614-555-0100",
    supplierTaxpayerIdPresent: true,
    ownerName: "Test Customer",
    ownerAddress: "500 Home St, Hilliard, OH 43026",
    ownerPhone: "614-555-0200",
    projectAddress: "500 Home St, Hilliard, OH 43026",
    scopeDescription: "Residential remodeling services and listed materials.",
    anticipatedStart: "September 2026",
    anticipatedCompletion: "October 2026",
    totalEstimatedCostPresent: true,
    excludedInstallationOrDeliveryCostsDisclosed: true,
    liabilityInsuranceDocumented: true,
    liabilityCoverageAmount: 1_000_000,
    excessCostMethod: "written",
    ...overrides,
  };
}

test("below-threshold Ohio contract does not trigger enhanced rule", () => {
  const result = evaluateOhioResidentialContract(covered({ totalAmount: 24_999 }));
  assert.equal(result.status, "COMPLIANT");
  assert.equal(result.applicable, false);
});

test("covered Ohio residential contract passes when required data is present", () => {
  const result = evaluateOhioResidentialContract(covered());
  assert.equal(result.status, "COMPLIANT");
  assert.equal(result.applicable, true);
});

test("missing insurance documentation blocks a covered contract", () => {
  const result = evaluateOhioResidentialContract(covered({ liabilityInsuranceDocumented: false }));
  assert.equal(result.status, "ACTION_REQUIRED");
  assert.ok(result.checks.some((check) => check.id === "insurance_documented" && check.status === "FAIL"));
});

test("unknown property classification requires review instead of guessing", () => {
  const result = evaluateOhioResidentialContract(covered({ propertyClass: "unknown" }));
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(result.applicable, null);
});

test("cost-plus contracts use the ORC 4722.02(C) exception path", () => {
  const result = evaluateOhioResidentialContract(covered({ pricingType: "cost_plus" }));
  assert.equal(result.status, "COMPLIANT");
  assert.equal(result.applicable, false);
  assert.ok(result.checks.some((check) => check.id === "cost_plus_exception" && check.status === "NOT_APPLICABLE"));
});

test("exactly $25,000 requires authorized review because the statutory boundary language differs", () => {
  const result = evaluateOhioResidentialContract(covered({ totalAmount: 25_000 }));
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.ok(result.checks.some((check) => check.id === "amount_boundary" && check.status === "REVIEW"));
});

test("coverage under $250,000 blocks covered supplier classification", () => {
  const result = evaluateOhioResidentialContract(covered({ liabilityCoverageAmount: 100_000 }));
  assert.equal(result.status, "ACTION_REQUIRED");
  assert.ok(result.checks.some((check) => check.id === "insurance_amount" && check.status === "FAIL"));
});

import assert from "node:assert/strict";
import test from "node:test";
import { calculateOhioHomeSolicitationDeadline, evaluateOhioHomeSolicitation, type HomeSolicitationInput } from "./ohio-home-solicitation";

function applicable(overrides: Partial<HomeSolicitationInput> = {}): HomeSolicitationInput {
  return {
    purchasePrice: 40_000,
    consumerPurpose: "yes",
    solicitationLocation: "buyer_residence",
    buyerInitiatedContact: false,
    sellerHasFixedOhioBusiness: true,
    entirelyMailOrPhoneBuyerInitiatedNoPriorContact: false,
    finalAgreementAfterPriorNegotiationsAtSellerBusiness: false,
    emergencyHandwrittenWaiver: false,
    federalRescissionRightApplies: false,
    sellerName: "Bango Construction LLC",
    sellerAddress: "123 Business St, Marysville, OH 43040",
    cancellationEmail: "contracts@example.com",
    cancellationFax: null,
    noticeTemplateReady: true,
    duplicateNoticeConfigured: true,
    signedSellerCopyConfigured: true,
    assistedLiveSigning: true,
    oralDisclosureWorkflowConfirmed: true,
    workStartHoldConfigured: true,
    ...overrides,
  };
}

test("covered home solicitation workflow passes when required controls are configured", () => {
  const result = evaluateOhioHomeSolicitation(applicable());
  assert.equal(result.applicable, true);
  assert.equal(result.status, "COMPLIANT");
});

test("buyer-initiated contact plus fixed Ohio business uses statutory exclusion", () => {
  const result = evaluateOhioHomeSolicitation(applicable({ buyerInitiatedContact: true }));
  assert.equal(result.applicable, false);
  assert.equal(result.status, "COMPLIANT");
});

test("unattended electronic signing requires review for oral disclosure", () => {
  const result = evaluateOhioHomeSolicitation(applicable({ assistedLiveSigning: false }));
  assert.equal(result.applicable, true);
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.ok(result.checks.some((check) => check.id === "oral_disclosure" && check.status === "REVIEW"));
});

test("missing duplicate cancellation notice blocks an applicable sale", () => {
  const result = evaluateOhioHomeSolicitation(applicable({ duplicateNoticeConfigured: false }));
  assert.equal(result.status, "ACTION_REQUIRED");
  assert.ok(result.checks.some((check) => check.id === "duplicate_notice" && check.status === "FAIL"));
});

test("unknown transaction context does not guess applicability", () => {
  const result = evaluateOhioHomeSolicitation(applicable({ solicitationLocation: "unknown" }));
  assert.equal(result.applicable, null);
  assert.equal(result.status, "REVIEW_REQUIRED");
});

test("Friday signing counts Saturday but not Sunday", () => {
  assert.equal(calculateOhioHomeSolicitationDeadline("2026-08-14"), "2026-08-18");
});

test("listed Ohio holiday is excluded from the three-business-day count", () => {
  assert.equal(calculateOhioHomeSolicitationDeadline("2026-09-05"), "2026-09-10");
});

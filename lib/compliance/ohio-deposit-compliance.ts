export type DepositComplianceStatus = "COMPLIANT" | "ACTION_REQUIRED" | "REVIEW_REQUIRED" | "NOT_APPLICABLE";

export type OhioDepositComplianceInput = {
  contractAmount: number;
  requestedDepositAmount: number;
  priorPrePerformancePayments?: number;
  homeConstructionApplicable: boolean | null;
  pricingType: "fixed" | "estimated" | "cost_plus" | "unknown";
  specialOrderAmount?: number | null;
  specialOrderNonreturnable?: boolean;
  constructionLoanPayment?: boolean;
  prePerformance: boolean | null;
};

export type OhioDepositComplianceEvaluation = {
  rulesetId: "OH_HOME_CONSTRUCTION_DOWN_PAYMENT";
  rulesetVersion: "2026-08-14.1";
  jurisdiction: "OH";
  status: DepositComplianceStatus;
  applicable: boolean | null;
  ordinaryLimit: number;
  qualifyingSpecialOrderLimit: number;
  conservativeMaximumPrePerformancePayment: number;
  priorPrePerformancePayments: number;
  requestedDepositAmount: number;
  prospectivePrePerformancePayments: number;
  reason: string;
  statutoryReferences: ["ORC 4722.04"];
};

const money = (value: number | null | undefined) => Number(Math.max(0, Number(value || 0)).toFixed(2));

export function evaluateOhioDepositCompliance(input: OhioDepositComplianceInput): OhioDepositComplianceEvaluation {
  const contractAmount = money(input.contractAmount);
  const requested = money(input.requestedDepositAmount);
  const prior = money(input.priorPrePerformancePayments);
  const ordinaryLimit = money(contractAmount * 0.1);
  const qualifyingSpecialOrderLimit = input.specialOrderNonreturnable === true
    ? money(money(input.specialOrderAmount) * 0.75)
    : 0;
  // ORC 4722.04 does not expressly define how a mixed ordinary + special-order down payment should
  // be allocated in software. Until company counsel adopts a more specific allocation policy, B.O.S.
  // uses the larger of the two independently stated statutory ceilings rather than adding them.
  const conservativeMaximum = Math.max(ordinaryLimit, qualifyingSpecialOrderLimit);
  const prospective = money(prior + requested);

  const result = (
    status: DepositComplianceStatus,
    applicable: boolean | null,
    reason: string,
  ): OhioDepositComplianceEvaluation => ({
    rulesetId: "OH_HOME_CONSTRUCTION_DOWN_PAYMENT",
    rulesetVersion: "2026-08-14.1",
    jurisdiction: "OH",
    status,
    applicable,
    ordinaryLimit,
    qualifyingSpecialOrderLimit,
    conservativeMaximumPrePerformancePayment: conservativeMaximum,
    priorPrePerformancePayments: prior,
    requestedDepositAmount: requested,
    prospectivePrePerformancePayments: prospective,
    reason,
    statutoryReferences: ["ORC 4722.04"],
  });

  if (input.homeConstructionApplicable === false) {
    return result("NOT_APPLICABLE", false, "The Ohio home-construction down-payment rule does not apply to this contract classification.");
  }
  if (input.homeConstructionApplicable == null) {
    return result("REVIEW_REQUIRED", null, "B.O.S. cannot determine whether the Ohio home-construction down-payment rule applies.");
  }
  if (input.pricingType === "cost_plus") {
    return result("NOT_APPLICABLE", false, "ORC 4722.04 does not apply to cost-plus contracts.");
  }
  if (input.pricingType === "unknown") {
    return result("REVIEW_REQUIRED", null, "Contract pricing type is required before collecting a covered pre-performance down payment.");
  }
  if (input.constructionLoanPayment === true) {
    return result("NOT_APPLICABLE", false, "The payment is explicitly classified as a construction-loan payment under ORC 4722.04.");
  }
  if (input.prePerformance == null) {
    return result("REVIEW_REQUIRED", null, "B.O.S. cannot determine whether contract performance has begun.");
  }
  if (input.prePerformance === false) {
    return result("NOT_APPLICABLE", false, "This evaluator governs down payments collected before contract performance begins.");
  }
  if (requested <= 0) {
    return result("ACTION_REQUIRED", true, "Deposit payment amount must be greater than zero.");
  }
  if (prospective > conservativeMaximum) {
    return result(
      "ACTION_REQUIRED",
      true,
      `The prospective pre-performance payment of $${prospective.toFixed(2)} exceeds B.O.S.'s conservative Ohio ceiling of $${conservativeMaximum.toFixed(2)}.`,
    );
  }

  return result("COMPLIANT", true, "The prospective pre-performance payment is within the currently enforced Ohio ceiling.");
}

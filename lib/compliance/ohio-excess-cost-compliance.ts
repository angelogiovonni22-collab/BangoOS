export const OHIO_EXCESS_COST_RULESET_ID = "ohio-orc-4722-excess-costs";
export const OHIO_EXCESS_COST_RULESET_VERSION = "2026-08-14.v1";
export const OHIO_EXCESS_COST_NOTICE_THRESHOLD_CENTS = 500_000;

export type OhioExcessCostEstimateMethod = "written" | "oral" | "firm_price_no_excess" | null;

export type OhioExcessCostEvidence = {
  method: "written" | "oral";
  providedAt: string | null;
  amountCents: number | null;
};

export type OhioOwnerApprovalEvidence = {
  approved: boolean;
  approvedAt: string | null;
  method: "signature" | "written" | "oral" | "portal" | "other" | null;
};

export type OhioExcessCostComplianceInput = {
  applicable: boolean | null;
  pricingType: "fixed" | "estimated" | "cost_plus" | "unknown";
  contractEstimateMethod: OhioExcessCostEstimateMethod;
  qualifiesAsReasonablyUnforeseenNecessary: boolean | null;
  currentExcessCostCents: number;
  priorQualifyingExcessCostCents: number;
  estimateEvidence?: OhioExcessCostEvidence | null;
  ownerApprovalEvidence?: OhioOwnerApprovalEvidence | null;
};

export type OhioExcessCostComplianceStatus = "COMPLIANT" | "ACTION_REQUIRED" | "REVIEW_REQUIRED";

export type OhioExcessCostComplianceResult = {
  rulesetId: typeof OHIO_EXCESS_COST_RULESET_ID;
  rulesetVersion: typeof OHIO_EXCESS_COST_RULESET_VERSION;
  jurisdiction: "OH";
  status: OhioExcessCostComplianceStatus;
  applicable: boolean | null;
  exemptReason: "cost_plus" | "firm_price_no_excess" | "not_applicable" | null;
  cumulativeQualifyingExcessCostCents: number;
  estimateNoticeRequired: boolean;
  ownerApprovalRequiredBeforeCharge: boolean;
  workMayStart: boolean;
  chargeMayProceed: boolean;
  reasons: string[];
};

function nonnegativeCents(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function hasOwnerApproval(evidence?: OhioOwnerApprovalEvidence | null) {
  return evidence?.approved === true && Boolean(evidence.approvedAt);
}

export function evaluateOhioExcessCostCompliance(
  input: OhioExcessCostComplianceInput,
): OhioExcessCostComplianceResult {
  const current = nonnegativeCents(input.currentExcessCostCents);
  const prior = nonnegativeCents(input.priorQualifyingExcessCostCents);
  const cumulative = current + prior;
  const reasons: string[] = [];

  if (input.applicable === false) {
    return {
      rulesetId: OHIO_EXCESS_COST_RULESET_ID,
      rulesetVersion: OHIO_EXCESS_COST_RULESET_VERSION,
      jurisdiction: "OH",
      status: "COMPLIANT",
      applicable: false,
      exemptReason: "not_applicable",
      cumulativeQualifyingExcessCostCents: cumulative,
      estimateNoticeRequired: false,
      ownerApprovalRequiredBeforeCharge: false,
      workMayStart: true,
      chargeMayProceed: true,
      reasons: ["Ohio home-construction excess-cost rules are not applicable to this contract."],
    };
  }

  if (input.applicable === null) {
    return {
      rulesetId: OHIO_EXCESS_COST_RULESET_ID,
      rulesetVersion: OHIO_EXCESS_COST_RULESET_VERSION,
      jurisdiction: "OH",
      status: "REVIEW_REQUIRED",
      applicable: null,
      exemptReason: null,
      cumulativeQualifyingExcessCostCents: cumulative,
      estimateNoticeRequired: false,
      ownerApprovalRequiredBeforeCharge: false,
      workMayStart: false,
      chargeMayProceed: false,
      reasons: ["Contract applicability has not been resolved."],
    };
  }

  if (input.pricingType === "cost_plus") {
    return {
      rulesetId: OHIO_EXCESS_COST_RULESET_ID,
      rulesetVersion: OHIO_EXCESS_COST_RULESET_VERSION,
      jurisdiction: "OH",
      status: "COMPLIANT",
      applicable: true,
      exemptReason: "cost_plus",
      cumulativeQualifyingExcessCostCents: cumulative,
      estimateNoticeRequired: false,
      ownerApprovalRequiredBeforeCharge: false,
      workMayStart: true,
      chargeMayProceed: true,
      reasons: ["Cost-plus contracts are exempt from the Chapter 4722 excess-cost requirements evaluated here."],
    };
  }

  if (input.qualifiesAsReasonablyUnforeseenNecessary === null) {
    return {
      rulesetId: OHIO_EXCESS_COST_RULESET_ID,
      rulesetVersion: OHIO_EXCESS_COST_RULESET_VERSION,
      jurisdiction: "OH",
      status: "REVIEW_REQUIRED",
      applicable: true,
      exemptReason: null,
      cumulativeQualifyingExcessCostCents: cumulative,
      estimateNoticeRequired: false,
      ownerApprovalRequiredBeforeCharge: current > 0,
      workMayStart: false,
      chargeMayProceed: false,
      reasons: ["Classify whether this change is a reasonably unforeseen but necessary excess cost before work or charging proceeds."],
    };
  }

  const ownerApprovalRequiredBeforeCharge = current > 0;
  const approvalSatisfied = !ownerApprovalRequiredBeforeCharge || hasOwnerApproval(input.ownerApprovalEvidence);

  if (!input.qualifiesAsReasonablyUnforeseenNecessary) {
    return {
      rulesetId: OHIO_EXCESS_COST_RULESET_ID,
      rulesetVersion: OHIO_EXCESS_COST_RULESET_VERSION,
      jurisdiction: "OH",
      status: approvalSatisfied ? "COMPLIANT" : "ACTION_REQUIRED",
      applicable: true,
      exemptReason: null,
      cumulativeQualifyingExcessCostCents: prior,
      estimateNoticeRequired: false,
      ownerApprovalRequiredBeforeCharge,
      workMayStart: true,
      chargeMayProceed: approvalSatisfied,
      reasons: approvalSatisfied
        ? ["No statutory excess-cost estimate notice is required for this classification, and owner approval for the charge is documented."]
        : ["This change does not trigger the special excess-cost estimate notice, but owner approval is still required before charging the excess cost."],
    };
  }

  if (input.contractEstimateMethod === "firm_price_no_excess") {
    return {
      rulesetId: OHIO_EXCESS_COST_RULESET_ID,
      rulesetVersion: OHIO_EXCESS_COST_RULESET_VERSION,
      jurisdiction: "OH",
      status: current > 0 ? "ACTION_REQUIRED" : "COMPLIANT",
      applicable: true,
      exemptReason: "firm_price_no_excess",
      cumulativeQualifyingExcessCostCents: cumulative,
      estimateNoticeRequired: false,
      ownerApprovalRequiredBeforeCharge: false,
      workMayStart: current === 0,
      chargeMayProceed: current === 0,
      reasons: current > 0
        ? ["The contract is configured as firm-price with no excess-cost charge; a qualifying excess charge cannot proceed under that configuration."]
        : ["No qualifying excess charge is being requested under the firm-price/no-excess configuration."],
    };
  }

  const estimateNoticeRequired = cumulative > OHIO_EXCESS_COST_NOTICE_THRESHOLD_CENTS;
  const expectedMethod = input.contractEstimateMethod === "written" || input.contractEstimateMethod === "oral"
    ? input.contractEstimateMethod
    : null;
  const estimateSatisfied = !estimateNoticeRequired || (
    expectedMethod !== null
    && input.estimateEvidence?.method === expectedMethod
    && Boolean(input.estimateEvidence.providedAt)
  );

  if (estimateNoticeRequired && !expectedMethod) {
    reasons.push("The contract does not contain a usable written/oral excess-cost estimate selection.");
  } else if (estimateNoticeRequired && !estimateSatisfied) {
    reasons.push(`Provide the owner the contract-selected ${expectedMethod ?? "written/oral"} excess-cost estimate before related work starts.`);
  }

  if (ownerApprovalRequiredBeforeCharge && !approvalSatisfied) {
    reasons.push("Owner approval evidence is required before charging this excess cost.");
  }

  const workMayStart = estimateSatisfied;
  const chargeMayProceed = estimateSatisfied && approvalSatisfied;

  return {
    rulesetId: OHIO_EXCESS_COST_RULESET_ID,
    rulesetVersion: OHIO_EXCESS_COST_RULESET_VERSION,
    jurisdiction: "OH",
    status: workMayStart && chargeMayProceed ? "COMPLIANT" : "ACTION_REQUIRED",
    applicable: true,
    exemptReason: null,
    cumulativeQualifyingExcessCostCents: cumulative,
    estimateNoticeRequired,
    ownerApprovalRequiredBeforeCharge,
    workMayStart,
    chargeMayProceed,
    reasons: reasons.length > 0 ? reasons : ["Required excess-cost estimate and owner-approval evidence are satisfied."],
  };
}

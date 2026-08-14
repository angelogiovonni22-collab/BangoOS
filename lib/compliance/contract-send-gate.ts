import { evaluateOhioResidentialContract, type ContractComplianceEvaluation } from "./contract-compliance";

export class ContractComplianceGateError extends Error {
  readonly code = "CONTRACT_COMPLIANCE_BLOCKED";
  readonly evaluation: ContractComplianceEvaluation;

  constructor(evaluation: ContractComplianceEvaluation) {
    const first = evaluation.checks.find((check) => check.status === "FAIL" || check.status === "REVIEW");
    super(first?.reason || "Contract compliance requires attention before this agreement can be sent.");
    this.name = "ContractComplianceGateError";
    this.evaluation = evaluation;
  }
}

export type ContractSendGateInput = {
  totalAmount: number;
  customerState?: string | null;
};

export function authorizeContractSend(input: ContractSendGateInput) {
  const evaluation = evaluateOhioResidentialContract({
    totalAmount: input.totalAmount,
    propertyState: input.customerState,
    // Phase 1 deliberately refuses to infer these legal classifications from an address or estimate title.
    // The forthcoming compliance details UI will capture them explicitly.
    propertyClass: "unknown",
    pricingType: "unknown",
  });

  if (evaluation.status !== "COMPLIANT") {
    throw new ContractComplianceGateError(evaluation);
  }

  return evaluation;
}

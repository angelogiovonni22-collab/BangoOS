export type ContractComplianceStatus = "COMPLIANT" | "ACTION_REQUIRED" | "REVIEW_REQUIRED";

export type OhioResidentialPropertyClass =
  | "one_to_three_family"
  | "individual_unit_in_four_plus"
  | "four_plus_common_or_building"
  | "condominium_common_area"
  | "manufactured_or_mobile"
  | "unknown";

export type ContractPricingType = "fixed" | "estimated" | "cost_plus" | "unknown";

export type ComplianceCheckStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";

export type ComplianceCheck = {
  id: string;
  label: string;
  status: ComplianceCheckStatus;
  reason?: string;
};

export type ContractComplianceEvaluation = {
  rulesetId: "OH_RESIDENTIAL_HOME_CONSTRUCTION";
  rulesetVersion: "2026-08-14.1";
  jurisdiction: "OH";
  status: ContractComplianceStatus;
  applicable: boolean | null;
  statutoryReferences: string[];
  checks: ComplianceCheck[];
};

export type OhioResidentialContractInput = {
  totalAmount: number;
  propertyState: string | null | undefined;
  propertyClass: OhioResidentialPropertyClass;
  pricingType: ContractPricingType;
  supplierName?: string | null;
  supplierPhysicalAddress?: string | null;
  supplierPhone?: string | null;
  supplierTaxpayerIdPresent?: boolean;
  ownerName?: string | null;
  ownerAddress?: string | null;
  ownerPhone?: string | null;
  projectAddress?: string | null;
  scopeDescription?: string | null;
  anticipatedStart?: string | null;
  anticipatedCompletion?: string | null;
  totalEstimatedCostPresent?: boolean;
  excludedInstallationOrDeliveryCostsDisclosed?: boolean;
  liabilityInsuranceDocumented?: boolean;
  liabilityCoverageAmount?: number | null;
  excessCostMethod?: "written" | "oral" | "firm_price_no_excess" | null;
};

const RULESET_ID = "OH_RESIDENTIAL_HOME_CONSTRUCTION" as const;
const RULESET_VERSION = "2026-08-14.1" as const;
const STATUTORY_REFERENCES = ["ORC 4722.01", "ORC 4722.02", "ORC 4722.04"];

function present(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function pass(id: string, label: string): ComplianceCheck {
  return { id, label, status: "PASS" };
}

function fail(id: string, label: string, reason: string): ComplianceCheck {
  return { id, label, status: "FAIL", reason };
}

function review(id: string, label: string, reason: string): ComplianceCheck {
  return { id, label, status: "REVIEW", reason };
}

function notApplicable(id: string, label: string, reason?: string): ComplianceCheck {
  return { id, label, status: "NOT_APPLICABLE", reason };
}

function requirement(id: string, label: string, satisfied: boolean, reason: string): ComplianceCheck {
  return satisfied ? pass(id, label) : fail(id, label, reason);
}

function result(applicable: boolean | null, checks: ComplianceCheck[]): ContractComplianceEvaluation {
  const hasFail = checks.some((check) => check.status === "FAIL");
  const hasReview = checks.some((check) => check.status === "REVIEW");
  const status: ContractComplianceStatus = hasFail
    ? "ACTION_REQUIRED"
    : hasReview
      ? "REVIEW_REQUIRED"
      : "COMPLIANT";

  return {
    rulesetId: RULESET_ID,
    rulesetVersion: RULESET_VERSION,
    jurisdiction: "OH",
    status,
    applicable,
    statutoryReferences: STATUTORY_REFERENCES,
    checks,
  };
}

export function evaluateOhioResidentialContract(input: OhioResidentialContractInput): ContractComplianceEvaluation {
  const checks: ComplianceCheck[] = [];
  const state = input.propertyState?.trim().toUpperCase();

  if (!state) {
    checks.push(review("jurisdiction", "Ohio jurisdiction", "Property state is missing, so B.O.S. cannot determine whether the Ohio ruleset applies."));
    return result(null, checks);
  }

  if (state !== "OH" && state !== "OHIO") {
    checks.push(notApplicable("jurisdiction", "Ohio jurisdiction", "Property is outside Ohio."));
    return result(false, checks);
  }

  checks.push(pass("jurisdiction", "Ohio jurisdiction"));

  // ORC 4722.02(A) requires the written contract when the service cost equals or exceeds $25,000.
  // ORC 4722.01(C) defines a "home construction service contract" as an amount exceeding $25,000.
  // Keep the boundary explicit and conservative rather than silently treating the two phrases as identical.
  if (input.totalAmount < 25_000) {
    checks.push(notApplicable("amount", "$25,000 Ohio enhanced contract threshold", "Contract amount is below $25,000."));
    return result(false, checks);
  }

  if (input.totalAmount === 25_000) {
    checks.push(review("amount_boundary", "$25,000 statutory boundary", "ORC 4722.02(A) uses 'equals or exceeds' while ORC 4722.01(C) defines the contract as 'exceeding' $25,000. Authorized review is required at the exact boundary."));
  } else {
    checks.push(pass("amount", "$25,000 Ohio enhanced contract threshold"));
  }

  if (input.pricingType === "cost_plus") {
    checks.push(notApplicable("cost_plus_exception", "ORC 4722.02 cost-plus exception", "ORC 4722.02(C) exempts cost-plus contracts from divisions (A) and (B) of that section."));
    return result(false, checks);
  }

  if (input.pricingType === "unknown") {
    checks.push(review("pricing_type", "Contract pricing classification", "B.O.S. cannot determine whether the cost-plus exception applies."));
  } else {
    checks.push(pass("pricing_type", "Contract pricing classification"));
  }

  if (input.propertyClass === "unknown") {
    checks.push(review("property_class", "Residential property classification", "B.O.S. cannot determine whether the property is within the residential-building definition in ORC 4722.01."));
    return result(null, checks);
  }

  if (["four_plus_common_or_building", "condominium_common_area", "manufactured_or_mobile"].includes(input.propertyClass)) {
    checks.push(notApplicable("property_class", "Residential property classification", "The supplied property classification is outside the covered residential-building scope for this ruleset."));
    return result(false, checks);
  }

  checks.push(pass("property_class", "Residential property classification"));

  checks.push(requirement("supplier_name", "Supplier legal name", present(input.supplierName), "Supplier legal name is required."));
  checks.push(requirement("supplier_address", "Supplier physical business address", present(input.supplierPhysicalAddress), "Supplier physical business address is required."));
  checks.push(requirement("supplier_phone", "Supplier business telephone number", present(input.supplierPhone), "Supplier business telephone number is required."));
  checks.push(requirement("supplier_tin", "Supplier taxpayer identification information", input.supplierTaxpayerIdPresent === true, "Supplier taxpayer identification information must be recorded for the contract without exposing it unnecessarily in customer-facing UI."));
  checks.push(requirement("owner_name", "Owner/customer name", present(input.ownerName), "Owner/customer name is required."));
  checks.push(requirement("owner_address", "Owner/customer address", present(input.ownerAddress), "Owner/customer address is required."));
  checks.push(requirement("owner_phone", "Owner/customer telephone number", present(input.ownerPhone), "Owner/customer telephone number is required."));
  checks.push(requirement("project_address", "Project property address or location", present(input.projectAddress), "Project property address or location is required."));
  checks.push(requirement("scope", "General description of construction services", present(input.scopeDescription), "The contract needs a general description of the home construction service, including goods and services to be furnished."));
  checks.push(requirement("anticipated_start", "Anticipated start date or period", present(input.anticipatedStart), "Anticipated start date or time period is required."));
  checks.push(requirement("anticipated_completion", "Anticipated completion date or period", present(input.anticipatedCompletion), "Anticipated completion date or time period is required."));
  checks.push(requirement("estimated_cost", "Total estimated contract cost", input.totalEstimatedCostPresent === true, "Total estimated contract cost must be present."));
  checks.push(requirement("excluded_costs", "Excluded installation/delivery/other cost disclosure", input.excludedInstallationOrDeliveryCostsDisclosed === true, "The contract must identify applicable installation, delivery, or other costs not included in the stated cost, or affirm that none are excluded."));
  checks.push(requirement("insurance_documented", "General liability insurance documentation", input.liabilityInsuranceDocumented === true, "Proof/copy of general liability insurance must be available."));

  if (input.liabilityCoverageAmount == null) {
    checks.push(fail("insurance_amount", "General liability coverage amount", "B.O.S. cannot verify the statutory minimum coverage amount."));
  } else {
    checks.push(requirement("insurance_amount", "General liability coverage amount", input.liabilityCoverageAmount >= 250_000, "General liability coverage must be at least $250,000 for this supplier classification."));
  }

  if (input.pricingType === "fixed" && input.excessCostMethod === "firm_price_no_excess") {
    checks.push(pass("excess_costs", "Excess-cost handling"));
  } else {
    checks.push(requirement("excess_costs", "Excess-cost estimate selection", input.excessCostMethod === "written" || input.excessCostMethod === "oral", "The owner must select the applicable written or oral excess-cost estimate method unless the contract is a firm price with no excess costs charged."));
  }

  return result(true, checks);
}

import {
  EXECUTION_CAPABILITIES,
  type BangoRoleDefinition,
} from "../core/context-types";

export const FINANCIAL_ROLE: BangoRoleDefinition = {
  roleId: "financial_advisor",
  displayNameKey: "bango.role.financial_advisor.name",
  descriptionKey: "bango.role.financial_advisor.description",
  version: "9.0.0",
  enabled: false,
  supportedRequestTypes: ["financial_health_review"],
  requiredContextScopes: ["company", "project", "customer"],
  requiredFutureContextScopes: ["task"],
  allowedCapabilities: [
    "read_project",
    "read_financials",
    "read_customers",
    "recommend_collection_action",
  ],
  deniedCapabilities: [...EXECUTION_CAPABILITIES],
  approvalPolicy: {
    defaultLevel: "manager_approval",
    capabilityOverrides: {
      recommend_collection_action: "user_confirmation",
      pay_invoice: "owner_approval",
    },
  },
  riskClassification: "critical",
  groundingRequirements: {
    requireDeterministicBriefing: true,
    requireDeterministicIntelligence: true,
    requiredEvidenceSourceTypes: ["project", "invoice", "change_order", "generated_intelligence"],
    minimumEvidenceCount: 4,
  },
};

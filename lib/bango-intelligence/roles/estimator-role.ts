import {
  EXECUTION_CAPABILITIES,
  type BangoRoleDefinition,
} from "../core/context-types";

export const ESTIMATOR_ROLE: BangoRoleDefinition = {
  roleId: "estimator",
  displayNameKey: "bango.role.estimator.name",
  descriptionKey: "bango.role.estimator.description",
  version: "9.0.0",
  enabled: false,
  supportedRequestTypes: ["estimate_scope_review"],
  requiredContextScopes: ["company", "project", "customer"],
  requiredFutureContextScopes: ["phase", "task"],
  allowedCapabilities: [
    "read_project",
    "read_customers",
    "read_financials",
    "read_documents",
    "recommend_estimate_adjustment",
    "draft_estimate_scope",
  ],
  deniedCapabilities: [...EXECUTION_CAPABILITIES],
  approvalPolicy: {
    defaultLevel: "manager_approval",
    capabilityOverrides: {
      draft_estimate_scope: "user_confirmation",
    },
  },
  riskClassification: "high",
  groundingRequirements: {
    requireDeterministicBriefing: false,
    requireDeterministicIntelligence: true,
    requiredEvidenceSourceTypes: ["project", "estimate", "change_order", "document"],
    minimumEvidenceCount: 4,
  },
};

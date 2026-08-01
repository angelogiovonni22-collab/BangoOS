import {
  EXECUTION_CAPABILITIES,
  type BangoRoleDefinition,
} from "../core/context-types";

export const PURCHASING_ROLE: BangoRoleDefinition = {
  roleId: "purchasing_assistant",
  displayNameKey: "bango.role.purchasing_assistant.name",
  descriptionKey: "bango.role.purchasing_assistant.description",
  version: "9.0.0",
  enabled: false,
  supportedRequestTypes: ["purchasing_recommendation"],
  requiredContextScopes: ["company", "project"],
  requiredFutureContextScopes: ["task"],
  allowedCapabilities: [
    "read_project",
    "read_purchasing",
    "read_documents",
    "recommend_purchase",
    "draft_vendor_message",
  ],
  deniedCapabilities: [...EXECUTION_CAPABILITIES],
  approvalPolicy: {
    defaultLevel: "manager_approval",
    capabilityOverrides: {
      draft_vendor_message: "user_confirmation",
    },
  },
  riskClassification: "high",
  groundingRequirements: {
    requireDeterministicBriefing: false,
    requireDeterministicIntelligence: true,
    requiredEvidenceSourceTypes: ["project", "task", "document", "generated_intelligence"],
    minimumEvidenceCount: 3,
  },
};

import {
  EXECUTION_CAPABILITIES,
  type BangoRoleDefinition,
} from "../core/context-types";

export const DOCUMENT_ROLE: BangoRoleDefinition = {
  roleId: "document_intelligence",
  displayNameKey: "bango.role.document_intelligence.name",
  descriptionKey: "bango.role.document_intelligence.description",
  version: "9.0.0",
  enabled: false,
  supportedRequestTypes: ["document_analysis"],
  requiredContextScopes: ["company", "project"],
  requiredFutureContextScopes: ["customer", "phase", "task"],
  allowedCapabilities: [
    "read_project",
    "read_documents",
    "read_customers",
    "draft_customer_message",
  ],
  deniedCapabilities: [...EXECUTION_CAPABILITIES],
  approvalPolicy: {
    defaultLevel: "user_confirmation",
    capabilityOverrides: {
      draft_customer_message: "user_confirmation",
    },
  },
  riskClassification: "high",
  groundingRequirements: {
    requireDeterministicBriefing: false,
    requireDeterministicIntelligence: true,
    requiredEvidenceSourceTypes: ["project", "document", "generated_intelligence"],
    minimumEvidenceCount: 2,
  },
};

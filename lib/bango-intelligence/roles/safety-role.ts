import {
  EXECUTION_CAPABILITIES,
  type BangoRoleDefinition,
} from "../core/context-types";

export const SAFETY_ROLE: BangoRoleDefinition = {
  roleId: "safety_manager",
  displayNameKey: "bango.role.safety_manager.name",
  descriptionKey: "bango.role.safety_manager.description",
  version: "9.0.0",
  enabled: false,
  supportedRequestTypes: ["safety_compliance_review"],
  requiredContextScopes: ["company", "project"],
  requiredFutureContextScopes: ["task"],
  allowedCapabilities: [
    "read_project",
    "read_tasks",
    "read_safety_records",
    "read_documents",
    "recommend_safety_review",
    "draft_daily_report",
  ],
  deniedCapabilities: [...EXECUTION_CAPABILITIES],
  approvalPolicy: {
    defaultLevel: "qualified_professional_approval",
    capabilityOverrides: {
      read_project: "none_required",
      read_tasks: "none_required",
      draft_daily_report: "user_confirmation",
    },
  },
  riskClassification: "critical",
  groundingRequirements: {
    requireDeterministicBriefing: true,
    requireDeterministicIntelligence: true,
    requiredEvidenceSourceTypes: ["project", "task", "risk", "document", "project_photo"],
    minimumEvidenceCount: 5,
  },
};

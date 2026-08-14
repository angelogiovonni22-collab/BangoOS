import {
  EXECUTION_CAPABILITIES,
  type BangoRoleDefinition,
} from "../core/context-types";

export const SUPERINTENDENT_ROLE: BangoRoleDefinition = {
  roleId: "superintendent",
  displayNameKey: "bango.role.superintendent.name",
  descriptionKey: "bango.role.superintendent.description",
  version: "9.0.0",
  enabled: true,
  supportedRequestTypes: [
    "narrate_briefing",
    "explain_health",
    "explain_risk",
  ],
  requiredContextScopes: ["company", "project"],
  requiredFutureContextScopes: ["task"],
  allowedCapabilities: [
    "read_project",
    "read_tasks",
    "read_financials",
    "recommend_task_priority",
    "recommend_schedule_change",
    "recommend_crew_assignment",
    "recommend_collection_action",
    "recommend_safety_review",
    "draft_daily_report",
  ],
  deniedCapabilities: [...EXECUTION_CAPABILITIES],
  approvalPolicy: {
    defaultLevel: "none_required",
    capabilityOverrides: {
      recommend_schedule_change: "manager_approval",
      recommend_crew_assignment: "manager_approval",
      recommend_collection_action: "user_confirmation",
      recommend_safety_review: "qualified_professional_approval",
      draft_daily_report: "user_confirmation",
    },
  },
  riskClassification: "moderate",
  groundingRequirements: {
    requireDeterministicBriefing: true,
    requireDeterministicIntelligence: true,
    requiredEvidenceSourceTypes: ["project", "task", "risk", "generated_intelligence"],
    minimumEvidenceCount: 3,
  },
};

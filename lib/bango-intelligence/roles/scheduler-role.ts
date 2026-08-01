import {
  EXECUTION_CAPABILITIES,
  type BangoRoleDefinition,
} from "../core/context-types";

export const SCHEDULER_ROLE: BangoRoleDefinition = {
  roleId: "scheduler",
  displayNameKey: "bango.role.scheduler.name",
  descriptionKey: "bango.role.scheduler.description",
  version: "9.0.0",
  enabled: false,
  supportedRequestTypes: ["schedule_optimization"],
  requiredContextScopes: ["company", "project"],
  requiredFutureContextScopes: ["phase", "task"],
  allowedCapabilities: [
    "read_project",
    "read_tasks",
    "read_schedule",
    "recommend_schedule_change",
    "recommend_task_priority",
    "recommend_crew_assignment",
  ],
  deniedCapabilities: [...EXECUTION_CAPABILITIES],
  approvalPolicy: {
    defaultLevel: "manager_approval",
    capabilityOverrides: {
      recommend_task_priority: "none_required",
    },
  },
  riskClassification: "high",
  groundingRequirements: {
    requireDeterministicBriefing: true,
    requireDeterministicIntelligence: true,
    requiredEvidenceSourceTypes: ["project", "task", "phase", "generated_intelligence"],
    minimumEvidenceCount: 4,
  },
};

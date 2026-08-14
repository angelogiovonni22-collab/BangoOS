import {
  EXECUTION_CAPABILITIES,
  type BangoRoleDefinition,
} from "../core/context-types";

export const HR_ROLE: BangoRoleDefinition = {
  roleId: "hr_assistant",
  displayNameKey: "bango.role.hr_assistant.name",
  descriptionKey: "bango.role.hr_assistant.description",
  version: "9.0.0",
  enabled: false,
  supportedRequestTypes: ["hr_workforce_review"],
  requiredContextScopes: ["company", "project"],
  requiredFutureContextScopes: ["task"],
  allowedCapabilities: [
    "read_project",
    "read_tasks",
    "read_employees",
    "recommend_crew_assignment",
  ],
  deniedCapabilities: [...EXECUTION_CAPABILITIES],
  approvalPolicy: {
    defaultLevel: "manager_approval",
    capabilityOverrides: {
      modify_payroll: "owner_approval",
      terminate_employee: "prohibited",
    },
  },
  riskClassification: "critical",
  groundingRequirements: {
    requireDeterministicBriefing: false,
    requireDeterministicIntelligence: true,
    requiredEvidenceSourceTypes: ["project", "task", "employee", "generated_intelligence"],
    minimumEvidenceCount: 4,
  },
};

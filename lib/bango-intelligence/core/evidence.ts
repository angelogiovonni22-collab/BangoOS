import type {
  BangoBusinessContext,
  BangoCapabilityId,
  BangoEvidence,
  BangoEvidenceSourceType,
  BangoRoleDefinition,
} from "./context-types";

const SOURCE_CAPABILITY_REQUIREMENTS: Partial<Record<BangoEvidenceSourceType, BangoCapabilityId>> = {
  project: "read_project",
  task: "read_tasks",
  phase: "read_tasks",
  risk: "read_tasks",
  invoice: "read_financials",
  estimate: "read_financials",
  change_order: "read_financials",
  project_photo: "read_project",
  employee: "read_employees",
  document: "read_documents",
  generated_intelligence: "read_project",
};

export function buildEvidenceFromContext(
  context: BangoBusinessContext,
): BangoEvidence[] {
  const project = context.project;
  if (!project) {
    return [];
  }

  const now = context.request.timestamp;

  const evidence: BangoEvidence[] = [
    {
      id: `project:${project.id}`,
      sourceType: "project",
      sourceId: project.id,
      companyId: context.company.id,
      projectId: project.id,
      label: "Project status",
      value: project.status,
      timestamp: now,
      route: `/projects/${project.id}`,
      sensitivity: "low",
    },
    {
      id: `project-health:${project.id}`,
      sourceType: "generated_intelligence",
      sourceId: project.id,
      companyId: context.company.id,
      projectId: project.id,
      label: "Health score",
      value: project.intelligence.healthScore,
      timestamp: now,
      route: `/projects/${project.id}`,
      sensitivity: "internal",
    },
    {
      id: `task-overdue:${project.id}`,
      sourceType: "task",
      sourceId: project.id,
      companyId: context.company.id,
      projectId: project.id,
      label: "Overdue task count",
      value: project.intelligence.overdueTasks,
      timestamp: now,
      route: `/projects/${project.id}`,
      sensitivity: "internal",
    },
    {
      id: `invoice-overdue:${project.id}`,
      sourceType: "invoice",
      sourceId: project.id,
      companyId: context.company.id,
      projectId: project.id,
      label: "Overdue invoice count",
      value: project.intelligence.overdueInvoices,
      timestamp: now,
      route: `/projects/${project.id}`,
      sensitivity: "sensitive",
    },
  ];

  for (const risk of project.intelligence.risks.slice(0, 5)) {
    evidence.push({
      id: `risk:${risk.id}`,
      sourceType: "risk",
      sourceId: risk.id,
      companyId: context.company.id,
      projectId: project.id,
      label: `Risk (${risk.severity})`,
      value: risk.message,
      timestamp: now,
      route: `/projects/${project.id}`,
      sensitivity: "internal",
    });
  }

  return evidence;
}

export function filterEvidenceByCapabilities(
  evidence: BangoEvidence[],
  role: BangoRoleDefinition,
): BangoEvidence[] {
  const allowed = new Set(role.allowedCapabilities);

  return evidence.filter((entry) => {
    const requiredCapability = SOURCE_CAPABILITY_REQUIREMENTS[entry.sourceType];
    if (!requiredCapability) {
      return true;
    }

    if (role.deniedCapabilities.includes(requiredCapability)) {
      return false;
    }

    return allowed.has(requiredCapability);
  });
}

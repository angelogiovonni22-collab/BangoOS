import type { OrionDecisionCandidate, OrionDecisionPriority, OrionDecisionRule } from "./decision-types";

function defaultCommandKeyForEntity(entityType: OrionDecisionCandidate["relatedEntity"]["type"]) {
  if (entityType === "estimate") {
    return "estimate.open";
  }

  if (entityType === "customer") {
    return "customer.open";
  }

  if (entityType === "project") {
    return "project.open";
  }

  if (entityType === "invoice") {
    return "invoice.open";
  }

  if (entityType === "crew") {
    return "crew.open";
  }

  if (entityType === "employee") {
    return "employee.open";
  }

  if (entityType === "schedule") {
    return "schedule.open";
  }

  return "dashboard.open";
}

export function defineDecisionRule(rule: OrionDecisionRule): OrionDecisionRule {
  return rule;
}

export function decisionId(input: {
  companyId: string;
  ruleId: string;
  entityType: string;
  entityId: string | null;
}) {
  return [
    input.companyId,
    input.ruleId,
    input.entityType,
    input.entityId || "company",
  ].join(":");
}

export function buildDecisionCandidate(input: {
  companyId: string;
  ruleId: string;
  priority: OrionDecisionPriority;
  category: OrionDecisionCandidate["category"];
  title: string;
  summary: string;
  recommendation: string;
  entityType: OrionDecisionCandidate["relatedEntity"]["type"];
  entityId: string | null;
  href: string;
  detectedAt: string;
  relatedEventId?: string | null;
  actionLabel: string;
  actionHref?: string;
}): OrionDecisionCandidate {
  const commandKey = defaultCommandKeyForEntity(input.entityType);

  return {
    decisionId: decisionId({
      companyId: input.companyId,
      ruleId: input.ruleId,
      entityType: input.entityType,
      entityId: input.entityId,
    }),
    companyId: input.companyId,
    ruleId: input.ruleId,
    priority: input.priority,
    category: input.category,
    severity: input.priority,
    title: input.title,
    summary: input.summary,
    recommendation: input.recommendation,
    relatedEntity: {
      type: input.entityType,
      id: input.entityId,
      href: input.href,
    },
    relatedEventId: input.relatedEventId || null,
    detectedAt: input.detectedAt,
    actionLabel: input.actionLabel,
    actionHref: input.actionHref || input.href,
    commandKey,
    commandInput: {
      entityType: input.entityType,
      entityId: input.entityId || "company",
      deepLink: input.actionHref || input.href,
    },
    confirmationLevel: "NONE",
    hrefFallback: input.actionHref || input.href,
    permissionRequirement: ["owner", "administrator", "operations_manager", "project_manager", "superintendent", "employee"],
    unsupportedReason: null,
  };
}

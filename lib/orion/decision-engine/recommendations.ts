import type { AdvisoryRecommendation, BusinessImpact, BusinessSignalCategory, BusinessSignalSeverity, EstimatedPriority } from "./types";

function toPriority(severity: BusinessSignalSeverity): EstimatedPriority {
  if (severity === "critical") {
    return "critical";
  }

  if (severity === "high") {
    return "high";
  }

  if (severity === "medium") {
    return "medium";
  }

  return "low";
}

function approvalBoundary(category: BusinessSignalCategory, impact: BusinessImpact) {
  if (impact === "CRITICAL" || impact === "HIGH") {
    return `${category} manager approval required before any operational change.`;
  }

  return `${category} lead review required before follow-up actions.`;
}

export function buildAdvisoryRecommendation(params: {
  category: BusinessSignalCategory;
  severity: BusinessSignalSeverity;
  observation: string;
  businessImpact: BusinessImpact;
  recommendationHint?: string;
}): AdvisoryRecommendation {
  const title = params.recommendationHint || `Review ${params.category} signal`;

  return {
    title,
    reason: params.observation,
    expectedOutcome: `Reduce ${params.category.toLowerCase()} risk exposure with a documented follow-up decision.`,
    estimatedPriority: toPriority(params.severity),
    approvalRequired: approvalBoundary(params.category, params.businessImpact),
  };
}

import { sortDecisionsByPriority } from "./decision-priority";
import type {
  OrionDecisionEngineResult,
  OrionDecisionHealthItem,
  OrionDecisionHealthRating,
  OrionDecisionRecord,
} from "./decision-types";

function toRating(score: number): OrionDecisionHealthRating {
  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 75) {
    return "Good";
  }

  if (score >= 55) {
    return "Attention";
  }

  return "Critical";
}

function penalty(decision: OrionDecisionRecord) {
  if (decision.priority === "critical") {
    return 18;
  }

  if (decision.priority === "high") {
    return 11;
  }

  if (decision.priority === "medium") {
    return 6;
  }

  return 3;
}

export function computeBusinessHealth(decisions: OrionDecisionRecord[]): OrionDecisionHealthItem[] {
  const active = decisions.filter((decision) => decision.status === "new" || decision.status === "acknowledged");
  const byCategory = {
    sales: active.filter((item) => item.category === "estimates"),
    operations: active.filter((item) => item.category === "projects" || item.category === "operations"),
    financial: active.filter((item) => item.category === "finance"),
    scheduling: active.filter((item) => item.category === "workforce" || item.category === "projects"),
    customer: active.filter((item) => item.category === "customers"),
  };

  const salesScore = Math.max(0, 100 - byCategory.sales.reduce((sum, item) => sum + penalty(item), 0));
  const operationsScore = Math.max(0, 100 - byCategory.operations.reduce((sum, item) => sum + penalty(item), 0));
  const financialScore = Math.max(0, 100 - byCategory.financial.reduce((sum, item) => sum + penalty(item), 0));
  const schedulingScore = Math.max(0, 100 - byCategory.scheduling.reduce((sum, item) => sum + penalty(item), 0));
  const customerScore = Math.max(0, 100 - byCategory.customer.reduce((sum, item) => sum + penalty(item), 0));

  const overallScore = Math.round((salesScore + operationsScore + financialScore + schedulingScore + customerScore) / 5);

  return [
    { id: "sales", score: salesScore, rating: toRating(salesScore) },
    { id: "operations", score: operationsScore, rating: toRating(operationsScore) },
    { id: "financial", score: financialScore, rating: toRating(financialScore) },
    { id: "scheduling", score: schedulingScore, rating: toRating(schedulingScore) },
    { id: "customer", score: customerScore, rating: toRating(customerScore) },
    { id: "overall", score: overallScore, rating: toRating(overallScore) },
  ];
}

function countByPriority(decisions: OrionDecisionRecord[]) {
  const riskSummary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const decision of decisions) {
    if (decision.status === "resolved" || decision.status === "dismissed") {
      continue;
    }

    riskSummary[decision.priority] += 1;
  }

  return riskSummary;
}

export function buildMorningBriefing(companyName: string | null, decisions: OrionDecisionRecord[], now: Date) {
  const dayPart = now.getHours() < 12 ? "Morning" : now.getHours() < 18 ? "Afternoon" : "Evening";
  const greeting = `Good ${dayPart}${companyName ? ` ${companyName}` : ""}.`;

  const active = [...decisions]
    .filter((decision) => decision.status === "new" || decision.status === "acknowledged")
    .sort(sortDecisionsByPriority)
    .slice(0, 5);

  const lines = active.length > 0
    ? active.map((decision) => `${decision.summary}`)
    : ["No urgent decisions detected for today."];

  return { greeting, lines };
}

export function buildDecisionResult(params: {
  companyId: string;
  detectedAt: string;
  decisions: OrionDecisionRecord[];
  companyName: string | null;
  now: Date;
}): OrionDecisionEngineResult {
  const sorted = [...params.decisions].sort(sortDecisionsByPriority);
  const topPriorities = sorted.filter((item) => item.status === "new" || item.status === "acknowledged").slice(0, 6);
  const criticalAlerts = sorted.filter((item) => item.priority === "critical" && (item.status === "new" || item.status === "acknowledged")).slice(0, 6);
  const todaysDecisions = sorted.filter((item) => item.detectedAt.slice(0, 10) === params.detectedAt.slice(0, 10));
  const recommendations = sorted.filter((item) => item.status === "new" || item.status === "acknowledged").slice(0, 8);

  return {
    companyId: params.companyId,
    detectedAt: params.detectedAt,
    decisions: sorted,
    topPriorities,
    criticalAlerts,
    todaysDecisions,
    recommendations,
    riskSummary: countByPriority(sorted),
    businessHealth: computeBusinessHealth(sorted),
    morningBriefing: buildMorningBriefing(params.companyName, sorted, params.now),
  };
}

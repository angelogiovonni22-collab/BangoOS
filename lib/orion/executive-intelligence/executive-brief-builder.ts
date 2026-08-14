import type { DataTrustSummary, ExecutiveBrief, ExecutiveBriefStatement, ExecutivePriority } from "./executive-intelligence-types";

function statement(input: {
  text: string;
  priorities: ExecutivePriority[];
  extraEvidence?: string[];
}): ExecutiveBriefStatement {
  const signalIds = [...new Set(input.priorities.flatMap((priority) => priority.signalIds))].sort((a, b) => a.localeCompare(b));
  const memoryIds = [...new Set(input.priorities.flatMap((priority) => priority.relatedMemoryIds))].sort((a, b) => a.localeCompare(b));
  const relationshipPathIds = [...new Set(input.priorities.flatMap((priority) => priority.relationshipPaths))].sort((a, b) => a.localeCompare(b));
  const evidence = [...new Set([
    ...input.priorities.flatMap((priority) => priority.evidence),
    ...(input.extraEvidence ?? []),
  ])].sort((a, b) => a.localeCompare(b));

  return {
    statement: input.text,
    signalIds,
    evidence,
    memoryIds,
    relationshipPathIds,
  };
}

function pickByCategory(priorities: ExecutivePriority[], category: ExecutivePriority["category"]): ExecutivePriority[] {
  return priorities.filter((priority) => priority.category === category);
}

export function buildExecutiveBrief(params: {
  companyId: string;
  priorities: ExecutivePriority[];
  dataTrust: DataTrustSummary;
  limitations: string[];
}): ExecutiveBrief {
  const topPriorities = params.priorities.slice(0, 3);
  const stable = params.priorities.filter((priority) => priority.severity === "low" || priority.severity === "info");
  const risks = params.priorities.filter((priority) => priority.severity === "critical" || priority.severity === "high");
  const opportunities = params.priorities.filter((priority) => priority.status === "improving");

  const companyState = risks.length > 0
    ? `Company ${params.companyId} has ${risks.length} high-exposure priorities requiring review.`
    : `Company ${params.companyId} is operating without critical exposure in this fixture window.`;

  return {
    greetingContext: statement({
      text: `Executive brief generated for ${params.companyId} using deterministic fixture intelligence.`,
      priorities: topPriorities,
    }),
    companyState: statement({
      text: companyState,
      priorities: topPriorities,
    }),
    topPriorities: topPriorities.map((priority) => statement({
      text: `${priority.title}: ${priority.observation}`,
      priorities: [priority],
    })),
    stableOperations: stable.length > 0
      ? stable.map((priority) => statement({
        text: `Stable: ${priority.observation}`,
        priorities: [priority],
      }))
      : [statement({ text: "No stable operations were identified in this fixture window.", priorities: [] })],
    emergingRisks: risks.length > 0
      ? risks.map((priority) => statement({
        text: `Risk: ${priority.observation}`,
        priorities: [priority],
      }))
      : [statement({ text: "No high-severity emerging risks were identified.", priorities: [] })],
    opportunities: opportunities.length > 0
      ? opportunities.map((priority) => statement({
        text: `Opportunity: ${priority.recommendation}`,
        priorities: [priority],
      }))
      : [statement({ text: "No immediate operational opportunities were identified.", priorities: [] })],
    cashFlowContext: pickByCategory(params.priorities, "financial").map((priority) => statement({
      text: `Cash-flow context: ${priority.observation}`,
      priorities: [priority],
    })),
    workforceContext: pickByCategory(params.priorities, "workforce").map((priority) => statement({
      text: `Workforce context: ${priority.observation}`,
      priorities: [priority],
    })),
    equipmentContext: pickByCategory(params.priorities, "equipment").map((priority) => statement({
      text: `Equipment context: ${priority.observation}`,
      priorities: [priority],
    })),
    scheduleContext: pickByCategory(params.priorities, "schedule").map((priority) => statement({
      text: `Schedule context: ${priority.observation}`,
      priorities: [priority],
    })),
    dataTrustSummary: statement({
      text: `Data trust is ${params.dataTrust.freshness}/${params.dataTrust.completeness} with ${params.dataTrust.unavailableSourceCount} unavailable sources.`,
      priorities: topPriorities,
      extraEvidence: params.dataTrust.confidenceExplanation,
    }),
    recommendedReviewOrder: params.priorities.map((priority) => priority.id),
    limitations: params.limitations,
  };
}

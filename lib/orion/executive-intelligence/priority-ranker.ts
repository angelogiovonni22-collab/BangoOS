import type { BusinessSignalSeverity } from "../decision-engine";
import type { ExecutivePriority, PriorityRankingInput } from "./executive-intelligence-types";

const severityRank: Record<BusinessSignalSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const urgencyRank: Record<ExecutivePriority["urgency"], number> = {
  immediate: 0,
  today: 1,
  soon: 2,
  monitor: 3,
};

const impactRank: Record<ExecutivePriority["businessImpact"], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  NONE: 4,
};

function stableId(parts: Array<string | number>): string {
  return parts.join("::").toLowerCase().replace(/[^a-z0-9:._-]/g, "_");
}

function dedupeIdentity(priority: ExecutivePriority): string {
  return stableId([
    priority.companyId,
    priority.canonicalConditionType,
    priority.affectedEntityIds.join("|"),
    priority.businessWindow,
    priority.ruleFamily,
  ]);
}

function freshnessScore(value: ExecutivePriority["freshness"]): number {
  if (value === "live") {
    return 4;
  }
  if (value === "partial") {
    return 3;
  }
  if (value === "stale") {
    return 2;
  }
  if (value === "mixed") {
    return 1;
  }
  return 0;
}

function businessImpactStatement(impact: ExecutivePriority["businessImpact"]): string {
  if (impact === "CRITICAL") {
    return "Immediate operational exposure is present.";
  }
  if (impact === "HIGH") {
    return "High operational exposure is present.";
  }
  if (impact === "MEDIUM") {
    return "Moderate operational exposure is present.";
  }
  if (impact === "LOW") {
    return "Low operational exposure is present.";
  }
  return "No direct exposure is currently measured.";
}

function computeStatus(input: PriorityRankingInput): ExecutivePriority["status"] {
  const hasMissingInfo = input.signal.missingInformation.length > 0;
  const unresolvedMemory = input.memory?.priorOutcomes.includes("unresolved") ?? false;
  const conflictingMemoryOutcomes = (input.memory?.priorOutcomes.length ?? 0) >= 2;
  const lowCompleteness = !input.graph?.graphContext || input.graph.graphContext.unresolvedReferences.length > 0;

  if (hasMissingInfo && lowCompleteness) {
    return "unverifiable";
  }

  if (unresolvedMemory) {
    return "unresolved";
  }

  if (conflictingMemoryOutcomes) {
    return "worsening";
  }

  if ((input.memory?.priorOutcomes.includes("resolved_unsuccessfully") ?? false) || input.signal.severity === "critical") {
    return "worsening";
  }

  if (input.memory?.priorOutcomes.includes("resolved_successfully") ?? false) {
    return "improving";
  }

  if (input.signal.severity === "high" || input.signal.severity === "medium") {
    return "ongoing";
  }

  return "new";
}

function mapFreshness(input: PriorityRankingInput): ExecutivePriority["freshness"] {
  const values = new Set<string>([input.signal.freshness]);
  if (input.memory?.historicalContext.freshness) {
    values.add(input.memory.historicalContext.freshness === "stale" ? "stale" : "partial");
  }
  if (input.graph?.graphContext.staleRelationships.length) {
    values.add("stale");
  }

  if (values.has("stale") && values.size > 1) {
    return "mixed";
  }

  if (values.has("stale")) {
    return "stale";
  }

  if (values.has("unknown")) {
    return "unknown";
  }

  if (values.has("partial")) {
    return "partial";
  }

  return "live";
}

function toPriority(input: PriorityRankingInput): ExecutivePriority {
  const relatedMemoryIds = input.memory?.historicalContext.matchedMemoryIds ?? [];
  const relatedGraphNodeIds = input.graph?.relatedEntities.map((node) => node.id) ?? [];
  const relationshipPaths = input.graph?.dependencyPaths.map((path) => path.relationshipSummary) ?? [];

  const signalConfidence = input.signal.confidence.percent / 100;
  const memoryConfidence = input.memory?.memoryConfidence.score ?? 0;
  const graphConfidence = input.graph?.graphConfidence.score ?? 0;
  const confidence = Number(((signalConfidence * 0.5) + (memoryConfidence * 0.3) + (graphConfidence * 0.2)).toFixed(4));

  const missingFields = [
    ...input.signal.missingInformation,
    ...(input.memory?.memoryLimitations ?? []),
    ...(input.graph?.graphLimitations ?? []),
  ];

  const dataCompleteness = {
    isComplete: missingFields.length === 0,
    missingFields: [...new Set(missingFields)].sort((a, b) => a.localeCompare(b)),
  };

  const evidence = input.signal.evidence.map((item) => `${item.source}: ${item.label}`);
  const confidenceReasons = [
    ...input.signal.confidence.reasons,
    ...(input.memory?.memoryConfidence.reasons ?? []),
    ...(input.graph?.graphConfidence.reasons ?? []),
  ];

  const affectedEntityIds = input.fact.entityReferences
    .map((entity) => `${entity.entityType}:${entity.entityId}`)
    .sort((a, b) => a.localeCompare(b));

  const priorityId = stableId([
    "executive-priority",
    input.fact.companyId,
    input.fact.canonicalConditionType,
    affectedEntityIds.join("|"),
    input.evaluationWindow.start,
    input.evaluationWindow.end,
    input.fact.ruleFamily,
  ]);

  const approvalBoundary = input.fact.approvalBoundary || input.decisionPack.approvalBoundary;

  return {
    id: priorityId,
    companyId: input.fact.companyId,
    title: `Review ${input.fact.canonicalConditionType.replace(/_/g, " ")}`,
    category: input.fact.category,
    severity: input.signal.severity,
    urgency: input.fact.urgency,
    observation: input.signal.observation,
    whyItMatters: businessImpactStatement(input.signal.businessImpact),
    businessImpact: input.signal.businessImpact,
    evidence,
    missingInformation: input.signal.missingInformation,
    recommendation: input.decisionPack.recommendation.title,
    approvalBoundary,
    signalIds: [input.signal.id],
    decisionPackIds: [input.decisionPack.signalId],
    relatedMemoryIds,
    relatedGraphNodeIds,
    relationshipPaths,
    confidence,
    confidenceReasons: [...new Set(confidenceReasons)].sort((a, b) => a.localeCompare(b)),
    freshness: mapFreshness(input),
    dataCompleteness,
    limitations: [...new Set([
      ...input.memory?.memoryLimitations ?? [],
      ...input.graph?.graphLimitations ?? [],
    ])].sort((a, b) => a.localeCompare(b)),
    status: computeStatus(input),
    canonicalConditionType: input.fact.canonicalConditionType,
    ruleFamily: input.fact.ruleFamily,
    affectedEntityIds,
    businessWindow: `${input.evaluationWindow.start}|${input.evaluationWindow.end}`,
  };
}

function comparePrecedence(left: ExecutivePriority, right: ExecutivePriority): number {
  const severityOrder = severityRank[left.severity] - severityRank[right.severity];
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const impactOrder = impactRank[left.businessImpact] - impactRank[right.businessImpact];
  if (impactOrder !== 0) {
    return impactOrder;
  }

  const urgencyOrder = urgencyRank[left.urgency] - urgencyRank[right.urgency];
  if (urgencyOrder !== 0) {
    return urgencyOrder;
  }

  const freshnessOrder = freshnessScore(right.freshness) - freshnessScore(left.freshness);
  if (freshnessOrder !== 0) {
    return freshnessOrder;
  }

  const evidenceOrder = right.evidence.length - left.evidence.length;
  if (evidenceOrder !== 0) {
    return evidenceOrder;
  }

  const confidenceOrder = right.confidence - left.confidence;
  if (confidenceOrder !== 0) {
    return confidenceOrder;
  }

  return left.id.localeCompare(right.id);
}

function shouldReplace(existing: ExecutivePriority, candidate: ExecutivePriority): boolean {
  const severityOrder = severityRank[candidate.severity] - severityRank[existing.severity];
  if (severityOrder < 0) {
    return true;
  }
  if (severityOrder > 0) {
    return false;
  }

  const impactOrder = impactRank[candidate.businessImpact] - impactRank[existing.businessImpact];
  if (impactOrder < 0) {
    return true;
  }
  if (impactOrder > 0) {
    return false;
  }

  if (candidate.evidence.length !== existing.evidence.length) {
    return candidate.evidence.length > existing.evidence.length;
  }

  const freshnessOrder = freshnessScore(candidate.freshness) - freshnessScore(existing.freshness);
  if (freshnessOrder !== 0) {
    return freshnessOrder > 0;
  }

  if (candidate.confidence !== existing.confidence) {
    return candidate.confidence > existing.confidence;
  }

  return candidate.id.localeCompare(existing.id) < 0;
}

export function rankExecutivePriorities(inputs: PriorityRankingInput[]): ExecutivePriority[] {
  const deduped = new Map<string, ExecutivePriority>();

  for (const input of inputs) {
    const priority = toPriority(input);
    const key = dedupeIdentity(priority);
    const existing = deduped.get(key);

    if (!existing || shouldReplace(existing, priority)) {
      deduped.set(key, priority);
    }
  }

  return [...deduped.values()].sort(comparePrecedence);
}

import type { MemoryCapabilities, MemoryEvidence, MemoryRecord, MemoryRetrievalQuery } from "./memory-types";
import { canReadMemory } from "./memory-filters";

export function rankMemories(records: MemoryRecord[], query: MemoryRetrievalQuery, capabilities: MemoryCapabilities): MemoryEvidence[] {
  const scored = records
    .filter((record) => canReadMemory(record, query, capabilities))
    .map((record) => ({ record, score: scoreRecord(record, query) }));

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return Date.parse(right.record.updatedAt) - Date.parse(left.record.updatedAt);
  });

  const limit = query.maxResults ?? 10;

  return scored.slice(0, limit).map(({ record, score }) => ({
    recordId: record.id,
    rank: score,
    scope: record.scope,
    category: record.category,
    title: record.title,
    summary: record.summary,
    importance: record.importance,
    confidence: record.confidence,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    tags: [...record.tags],
    sourceReferences: [...record.sourceReferences],
  }));
}

function scoreRecord(record: MemoryRecord, query: MemoryRetrievalQuery): number {
  let score = importanceWeight(record.importance) * 100;
  score += confidenceWeight(record.confidence) * 10;
  score += recencyWeight(record.updatedAt) * 20;

  if (query.scope && matchesScope(record.scope, query.scope)) {
    score += 1000;
  }

  if (query.projectId && record.projectId === query.projectId) score += 900;
  if (query.customerId && record.customerId === query.customerId) score += 800;
  if (query.userId && record.userId === query.userId) score += 700;
  if (query.taskId && record.taskId === query.taskId) score += 650;
  if (query.phaseId && record.phaseId === query.phaseId) score += 650;

  if (query.categories?.includes(record.category)) {
    score += 250;
  }

  score += relevanceBoost(record, query);
  return score;
}

function relevanceBoost(record: MemoryRecord, query: MemoryRetrievalQuery): number {
  const requestType = query.requestType ?? "";
  if (requestType.includes("schedule") && (record.category === "operational_pattern" || record.category === "project_milestone")) return 60;
  if (requestType.includes("customer") && record.category === "customer_preference") return 60;
  if (requestType.includes("financial") && record.category === "financial_insight") return 60;
  if (requestType.includes("estimate") && (record.category === "decision" || record.category === "recommendation")) return 45;
  return 0;
}

function importanceWeight(value: MemoryRecord["importance"]): number {
  switch (value) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
  }
}

function confidenceWeight(value: MemoryRecord["confidence"]): number {
  switch (value) {
    case "verified": return 4;
    case "observed": return 3;
    case "inferred": return 2;
    case "draft": return 1;
  }
}

function recencyWeight(updatedAt: string): number {
  const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(updatedAt)) / 86_400_000));
  return Math.max(0, 30 - Math.min(ageDays, 30));
}

function matchesScope(scope: MemoryRecord["scope"], target: MemoryRetrievalQuery["scope"]): boolean {
  const scopes = Array.isArray(target) ? target : [target];
  return scopes.includes(scope);
}

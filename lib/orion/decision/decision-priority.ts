import type { OrionDecisionPriority, OrionDecisionRecord } from "./decision-types";

const PRIORITY_SCORE: Record<OrionDecisionPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function priorityScore(priority: OrionDecisionPriority) {
  return PRIORITY_SCORE[priority];
}

export function sortDecisionsByPriority(left: OrionDecisionRecord, right: OrionDecisionRecord) {
  const scoreDiff = priorityScore(right.priority) - priorityScore(left.priority);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  if (left.detectedAt === right.detectedAt) {
    return left.decisionId.localeCompare(right.decisionId);
  }

  return right.detectedAt.localeCompare(left.detectedAt);
}

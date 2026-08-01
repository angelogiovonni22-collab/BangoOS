import type { LearningConfidence, LearningMetricRecord } from "./metric-types";

export function mergeEvidenceIds(...evidenceSets: ReadonlyArray<ReadonlyArray<string>>): string[] {
  const unique = new Set<string>();
  for (const set of evidenceSets) {
    for (const id of set) {
      if (id) {
        unique.add(id);
      }
    }
  }
  return Array.from(unique);
}

export function maxConfidence(a: LearningConfidence, b: LearningConfidence): LearningConfidence {
  const rank: Record<LearningConfidence, number> = {
    insufficient: 0,
    low: 1,
    medium: 2,
    high: 3,
  };

  return rank[a] >= rank[b] ? a : b;
}

export function filterMetricsByMinimumConfidence(
  metrics: ReadonlyArray<LearningMetricRecord>,
  min: LearningConfidence,
): LearningMetricRecord[] {
  const rank: Record<LearningConfidence, number> = {
    insufficient: 0,
    low: 1,
    medium: 2,
    high: 3,
  };

  const threshold = rank[min];
  return metrics.filter((metric) => rank[metric.confidence] >= threshold);
}

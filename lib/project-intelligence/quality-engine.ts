import type { QualityIntelligence } from "./intelligence-types";

type QualityTaskInput = {
  status: string;
  completion_percentage: number;
};

type QualityCountsInput = {
  photos: number;
};

type QualityProjectInput = {
  description: string | null;
};

/**
 * Derives quality intelligence from already-loaded workspace data.
 * No Supabase queries are performed here.
 *
 * taskCompletionTrend is approximated from the ratio of completed tasks to
 * total tasks. Full trend history would require additional queries; this
 * implementation uses what is already loaded.
 */
export function buildQualityIntelligence(
  project: QualityProjectInput,
  tasks: QualityTaskInput[],
  counts: QualityCountsInput,
): QualityIntelligence {
  const documentationPresent =
    typeof project.description === "string" &&
    project.description.trim().length > 10;

  const taskCompletionTrend = deriveCompletionTrend(tasks);

  return {
    photosCount: Math.max(0, counts.photos),
    documentationPresent,
    taskCompletionTrend,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveCompletionTrend(
  tasks: QualityTaskInput[],
): QualityIntelligence["taskCompletionTrend"] {
  if (tasks.length === 0) {
    return "unknown";
  }

  const completedCount = tasks.filter((t) =>
    t.status.trim().toLowerCase() === "completed",
  ).length;

  const completionRatio = completedCount / tasks.length;

  if (completionRatio >= 0.6) {
    return "improving";
  }

  if (completionRatio > 0) {
    return "stable";
  }

  return "unknown";
}

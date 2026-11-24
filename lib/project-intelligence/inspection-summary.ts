import type { ProjectEvent, ProjectTimelineSummary } from "./types";

const INSPECTION_RESULTS: Partial<Record<ProjectEvent["eventType"], ProjectTimelineSummary["latestInspectionResult"]>> = {
  inspection_created: "required",
  inspection_scheduled: "scheduled",
  inspection_rescheduled: "scheduled",
  inspection_started: "in_progress",
  inspection_passed: "passed",
  inspection_failed: "failed",
  inspection_cancelled: "cancelled",
  inspection_reinspection_required: "reinspection_required",
};

export function latestInspectionResult(
  events: ReadonlyArray<Pick<ProjectEvent, "eventType" | "occurredAt">>,
): ProjectTimelineSummary["latestInspectionResult"] {
  let result: ProjectTimelineSummary["latestInspectionResult"] = "none";
  let latestTime = -Infinity;
  for (const event of events) {
    const candidate = INSPECTION_RESULTS[event.eventType];
    const timestamp = Date.parse(event.occurredAt);
    if (candidate && Number.isFinite(timestamp) && timestamp > latestTime) {
      result = candidate;
      latestTime = timestamp;
    }
  }
  return result;
}

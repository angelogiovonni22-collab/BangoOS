import type { DashboardSectionErrors } from "@/lib/dashboard/types";
import type { ExecutiveLimitation, ExecutivePriorityItem, ExecutiveReadinessState } from "./executive-brief-types";

export function deriveExecutiveReadinessState(input: {
  sectionErrors: DashboardSectionErrors;
  limitations: ExecutiveLimitation[];
  priorityItems: ExecutivePriorityItem[];
}): ExecutiveReadinessState {
  const { sectionErrors, limitations, priorityItems } = input;
  const hasSectionErrors = Object.values(sectionErrors).some(Boolean);
  if (hasSectionErrors) {
    return "attention";
  }

  const topSeverity = priorityItems[0]?.severity;
  if (topSeverity === "critical" || topSeverity === "high") {
    return "attention";
  }

  if (limitations.length > 0) {
    return "limited";
  }

  return "ready";
}

export function readinessTone(state: ExecutiveReadinessState) {
  if (state === "ready") {
    return "success";
  }

  if (state === "limited") {
    return "warning";
  }

  return "danger";
}
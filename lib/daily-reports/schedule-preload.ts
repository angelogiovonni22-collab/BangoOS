import type { ScheduleAssignment } from "@/lib/scheduling/types";

export function matchingDailyReportAssignments<T extends Pick<ScheduleAssignment, "date" | "status"> & { assignedCrewIds?: readonly string[] }>(
  assignments: readonly T[], date: string, crewId?: string,
): T[] {
  return assignments.filter((assignment) => assignment.date === date && assignment.status !== "cancelled" && (!crewId || assignment.assignedCrewIds?.includes(crewId)));
}

export function selectDailyReportAssignment<T extends Pick<ScheduleAssignment, "id" | "date" | "status"> & { assignedCrewIds?: readonly string[] }>(
  assignments: readonly T[], date: string, crewId?: string, assignmentId?: string,
): T | null {
  const matching = matchingDailyReportAssignments(assignments, date, crewId);
  if (assignmentId) {
    const selected = matching.find((assignment) => assignment.id === assignmentId);
    if (!selected) throw new Error("The selected job no longer matches this crew and report date. Choose a scheduled job again.");
    return selected;
  }
  if (crewId && matching.length > 1) throw new Error("Choose a scheduled job for this crew and report date before saving a report.");
  return matching[0] ?? null;
}

import type { ScheduleAssignment } from "@/lib/scheduling/types";

export function selectDailyReportAssignment<T extends Pick<ScheduleAssignment, "date" | "status"> & { assignedCrewIds?: readonly string[] }>(
  assignments: readonly T[],
  date: string,
  crewId?: string,
): T | null {
  return assignments.find((assignment) => assignment.date === date && assignment.status !== "cancelled" && (!crewId || assignment.assignedCrewIds?.includes(crewId))) ?? null;
}

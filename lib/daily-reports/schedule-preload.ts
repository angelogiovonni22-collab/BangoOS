import type { ScheduleAssignment } from "@/lib/scheduling/types";

export function selectDailyReportAssignment<T extends Pick<ScheduleAssignment, "date" | "status">>(
  assignments: readonly T[],
  date: string,
): T | null {
  return assignments.find((assignment) => assignment.date === date && assignment.status !== "cancelled") ?? null;
}

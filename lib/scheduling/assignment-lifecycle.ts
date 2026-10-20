import type { ScheduleAssignment } from "./types";

/** Historical calendar records do not create current staffing demand. */
export function isActiveScheduleAssignment(assignment: Pick<ScheduleAssignment, "status">): boolean {
  return assignment.status !== "completed" && assignment.status !== "cancelled";
}

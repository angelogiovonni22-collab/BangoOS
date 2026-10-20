import { isActiveScheduleAssignment } from "./assignment-lifecycle";
import { resolveScheduleTimeZone, scheduleClock } from "./time-zone";
import type { ScheduleConflict, SchedulingPayload } from "./types";

export function staffingProjectCount(conflicts: Array<Pick<ScheduleConflict, "type" | "relatedProjectId" | "id" | "resolutionStatus">>, type: "understaffed_project" | "overstaffed_project"): number {
  return new Set(conflicts.filter(row => row.type === type && row.resolutionStatus === "open").map(row => row.relatedProjectId || row.id)).size;
}

/** Count each staffing gap once, including standalone unfilled demand. */
export function openStaffingCount(payload: Pick<SchedulingPayload, "assignments" | "openShifts">): number {
  const active = payload.assignments.filter(isActiveScheduleAssignment);
  const historical = new Set(payload.assignments.filter(row => !isActiveScheduleAssignment(row)).map(row => row.id));
  const represented = new Set(payload.openShifts.map(row => row.assignmentId));
  const gaps = new Set(active.filter(row => !represented.has(row.id) && row.requiredHeadcount > row.assignedEmployeeIds.length).map(row => row.id));
  for (const shift of payload.openShifts) {
    if (!shift.dismissed && !historical.has(shift.assignmentId)) gaps.add(shift.assignmentId || shift.id);
  }
  return gaps.size;
}

export function activeAssignmentsOnDate(payload: Pick<SchedulingPayload, "assignments" | "timeZone">, asOf: string | Date) {
  const date = scheduleClock(asOf instanceof Date ? asOf.toISOString() : asOf, resolveScheduleTimeZone(payload.timeZone)).date;
  return payload.assignments.filter(row => isActiveScheduleAssignment(row) && row.date === date);
}

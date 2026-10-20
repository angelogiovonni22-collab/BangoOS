import type { AssignmentDraft } from "./types";

/** Crew members are staffing context, not a replacement for the booked crew. */
export function assignmentAssignee(draft: Pick<AssignmentDraft, "assignedCrewIds" | "assignedEmployeeIds">) {
  const crewId = draft.assignedCrewIds[0] ?? null;
  const employeeId = crewId ? null : draft.assignedEmployeeIds[0] ?? null;
  return { crewId, employeeId, useEmployee: Boolean(employeeId) };
}

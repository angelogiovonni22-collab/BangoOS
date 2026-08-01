import type {
  WorkforceAssignmentRow,
  WorkforceCrewRow,
  WorkforceEmployeeRow,
  WorkforceMembershipRow,
} from "./workforce-types";

export function isActiveEmployee(employee: Pick<WorkforceEmployeeRow, "employment_status">) {
  return employee.employment_status === "active";
}

export function isAvailableEmployee(employee: Pick<WorkforceEmployeeRow, "employment_status" | "availability_status">) {
  return isActiveEmployee(employee) && employee.availability_status === "available";
}

export function isActiveCrew(crew: Pick<WorkforceCrewRow, "status">) {
  return crew.status === "active";
}

export function isCurrentMembership(
  membership: Pick<WorkforceMembershipRow, "status" | "starts_on" | "ends_on">,
  asOf = new Date(),
) {
  if (membership.status !== "active") {
    return false;
  }

  const current = toUtcDate(asOf);
  if (current === null) {
    return false;
  }

  const startsOn = toUtcDate(membership.starts_on);

  if (!startsOn || startsOn > current) {
    return false;
  }

  const endsOn = membership.ends_on ? toUtcDate(membership.ends_on) : null;
  return endsOn === null || endsOn >= current;
}

export function isActiveAssignment(assignment: Pick<WorkforceAssignmentRow, "status">) {
  return assignment.status === "planned" || assignment.status === "confirmed" || assignment.status === "in_progress";
}

export function hasAssignmentConflict(
  assignment: WorkforceAssignmentRow,
  otherAssignments: WorkforceAssignmentRow[],
) {
  if (!isActiveAssignment(assignment)) {
    return false;
  }

  return otherAssignments.some((other) => {
    if (other.id === assignment.id || other.company_id !== assignment.company_id) {
      return false;
    }

    if (!isActiveAssignment(other)) {
      return false;
    }

    if (!rangesOverlap(assignment.starts_at, assignment.ends_at, other.starts_at, other.ends_at)) {
      return false;
    }

    if (assignment.assignment_type === "crew" && other.assignment_type === "crew") {
      return assignment.crew_id !== null && assignment.crew_id === other.crew_id;
    }

    if (assignment.assignment_type === "employee" && other.assignment_type === "employee") {
      return assignment.employee_id !== null && assignment.employee_id === other.employee_id;
    }

    return false;
  });
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return aStart < bEnd && bStart < aEnd;
}

function toUtcDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
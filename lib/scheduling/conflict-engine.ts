import type {
  OpenShift,
  ResourceAvailability,
  ScheduleAssignment,
  ScheduleConflict,
  SchedulingPayload,
  TimeOffEntry,
} from "./types";

type ConflictEngineInput = {
  assignments: ScheduleAssignment[];
  openShifts: OpenShift[];
  availability: ResourceAvailability[];
  timeOff: TimeOffEntry[];
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aStartMs = new Date(aStart).getTime();
  const aEndMs = new Date(aEnd).getTime();
  const bStartMs = new Date(bStart).getTime();
  const bEndMs = new Date(bEnd).getTime();

  return aStartMs < bEndMs && bStartMs < aEndMs;
}

function toDateTime(date: string, time: string) {
  return `${date}T${time}:00Z`;
}

function hoursBetween(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

function pushUnique(target: ScheduleConflict[], conflict: ScheduleConflict) {
  if (!target.some((item) => item.id === conflict.id)) {
    target.push(conflict);
  }
}

export function detectSchedulingConflicts(input: ConflictEngineInput): ScheduleConflict[] {
  const { assignments, openShifts, availability, timeOff } = input;
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < assignments.length; i += 1) {
    const current = assignments[i];

    for (let j = i + 1; j < assignments.length; j += 1) {
      const other = assignments[j];
      const currentStart = toDateTime(current.date, current.startTime);
      const currentEnd = toDateTime(current.date, current.endTime);
      const otherStart = toDateTime(other.date, other.startTime);
      const otherEnd = toDateTime(other.date, other.endTime);

      if (!overlaps(currentStart, currentEnd, otherStart, otherEnd)) {
        continue;
      }

      const employeeOverlap = current.assignedEmployeeIds.filter((employeeId) =>
        other.assignedEmployeeIds.includes(employeeId),
      );

      if (employeeOverlap.length > 0) {
        pushUnique(conflicts, {
          id: `conf-emp-overlap-${current.id}-${other.id}`,
          type: "employee_double_booking",
          severity: "critical",
          title: "Employee double-booked",
          explanation: "At least one employee is assigned to overlapping work windows.",
          affectedResources: employeeOverlap,
          affectedAssignments: [current.id, other.id],
          recommendedAction: "Reassign one employee or move one assignment window.",
          resolutionStatus: "open",
          relatedProjectId: current.scope.projectId,
          relatedCrewId: null,
          relatedEmployeeId: employeeOverlap[0] || null,
        });
      }

      const crewOverlap = current.assignedCrewIds.filter((crewId) =>
        other.assignedCrewIds.includes(crewId),
      );

      if (crewOverlap.length > 0) {
        pushUnique(conflicts, {
          id: `conf-crew-overlap-${current.id}-${other.id}`,
          type: "crew_double_booking",
          severity: "high",
          title: "Crew double-booked",
          explanation: "A crew is assigned to two overlapping assignments.",
          affectedResources: crewOverlap,
          affectedAssignments: [current.id, other.id],
          recommendedAction: "Move crew to nearest open shift or split crew.",
          resolutionStatus: "open",
          relatedProjectId: current.scope.projectId,
          relatedCrewId: crewOverlap[0] || null,
          relatedEmployeeId: null,
        });
      }

      if (current.scope.supervisor === other.scope.supervisor) {
        pushUnique(conflicts, {
          id: `conf-supervisor-${current.id}-${other.id}`,
          type: "supervisor_conflict",
          severity: "medium",
          title: "Supervisor overlap",
          explanation: "The same supervisor is responsible for overlapping critical work.",
          affectedResources: [current.scope.supervisor],
          affectedAssignments: [current.id, other.id],
          recommendedAction: "Assign backup supervision or stagger critical milestones.",
          resolutionStatus: "open",
          relatedProjectId: current.scope.projectId,
          relatedCrewId: null,
          relatedEmployeeId: null,
        });
      }
    }

    const assignmentStart = toDateTime(current.date, current.startTime);
    const assignmentEnd = toDateTime(current.date, current.endTime);

    const ptoConflicts = timeOff.filter((entry) =>
      current.assignedEmployeeIds.includes(entry.employeeId)
      && overlaps(assignmentStart, assignmentEnd, entry.start, entry.end),
    );

    for (const pto of ptoConflicts) {
      pushUnique(conflicts, {
        id: `conf-pto-${current.id}-${pto.id}`,
        type: "employee_pto_conflict",
        severity: "high",
        title: "Employee unavailable",
        explanation: `${pto.employeeName} has ${pto.type.replace(/_/g, " ")} during this assignment.`,
        affectedResources: [pto.employeeId],
        affectedAssignments: [current.id],
        recommendedAction: "Assign a replacement from available resources.",
        resolutionStatus: "open",
        relatedProjectId: current.scope.projectId,
        relatedCrewId: null,
        relatedEmployeeId: pto.employeeId,
      });
    }

    const totalHours = hoursBetween(assignmentStart, assignmentEnd);
    if (totalHours > 10) {
      pushUnique(conflicts, {
        id: `conf-overtime-${current.id}`,
        type: "overtime_threshold_risk",
        severity: "medium",
        title: "Overtime threshold risk",
        explanation: "Assignment window exceeds the default 10-hour threshold.",
        affectedResources: [...current.assignedEmployeeIds],
        affectedAssignments: [current.id],
        recommendedAction: "Split work across two shifts or add staffing.",
        resolutionStatus: "open",
        relatedProjectId: current.scope.projectId,
        relatedCrewId: current.assignedCrewIds[0] || null,
        relatedEmployeeId: current.assignedEmployeeIds[0] || null,
      });
    }

    if (current.travelTimeMinutes > 80) {
      pushUnique(conflicts, {
        id: `conf-travel-${current.id}`,
        type: "excessive_travel_time",
        severity: "medium",
        title: "Excessive travel time",
        explanation: "Travel duration exceeds 80 minutes and may impact punctuality.",
        affectedResources: [...current.assignedCrewIds],
        affectedAssignments: [current.id],
        recommendedAction: "Move dispatch time earlier or replace with closer crew.",
        resolutionStatus: "open",
        relatedProjectId: current.scope.projectId,
        relatedCrewId: current.assignedCrewIds[0] || null,
        relatedEmployeeId: null,
      });
    }

    if (current.assignedEmployeeIds.length < current.requiredHeadcount) {
      pushUnique(conflicts, {
        id: `conf-understaffed-${current.id}`,
        type: "understaffed_project",
        severity: "high",
        title: "Understaffed assignment",
        explanation: "Required headcount exceeds currently assigned employees.",
        affectedResources: [current.scope.projectName],
        affectedAssignments: [current.id],
        recommendedAction: "Fill with open-shift candidates or assign an additional crew.",
        resolutionStatus: "open",
        relatedProjectId: current.scope.projectId,
        relatedCrewId: current.assignedCrewIds[0] || null,
        relatedEmployeeId: null,
      });
    }

    if (current.assignedEmployeeIds.length > current.requiredHeadcount + 2) {
      pushUnique(conflicts, {
        id: `conf-overstaffed-${current.id}`,
        type: "overstaffed_project",
        severity: "low",
        title: "Overstaffed assignment",
        explanation: "Staffing exceeds expected headcount by more than two workers.",
        affectedResources: [current.scope.projectName],
        affectedAssignments: [current.id],
        recommendedAction: "Reallocate spare capacity to open shifts.",
        resolutionStatus: "open",
        relatedProjectId: current.scope.projectId,
        relatedCrewId: current.assignedCrewIds[0] || null,
        relatedEmployeeId: null,
      });
    }
  }

  for (const shift of openShifts) {
    if (shift.workersNeeded > 2) {
      pushUnique(conflicts, {
        id: `conf-open-shift-${shift.id}`,
        type: "understaffed_project",
        severity: shift.urgency === "critical" ? "critical" : "high",
        title: "Open shift staffing risk",
        explanation: `Open shift requires ${shift.workersNeeded} workers and remains unfilled.`,
        affectedResources: [shift.projectName],
        affectedAssignments: [shift.assignmentId],
        recommendedAction: "Use recommended matches and publish dispatch update.",
        resolutionStatus: "open",
        relatedProjectId: shift.projectId,
        relatedCrewId: null,
        relatedEmployeeId: null,
      });
    }
  }

  const unavailable = availability.filter((item) => item.availability === "unavailable" || item.availability === "pto");
  if (unavailable.length > 8) {
    pushUnique(conflicts, {
      id: "conf-global-availability",
      type: "shift_overlap",
      severity: "low",
      title: "Limited available staffing",
      explanation: "Current availability pool is constrained for the selected period.",
      affectedResources: unavailable.map((item) => item.resourceId),
      affectedAssignments: [],
      recommendedAction: "Enable cross-trade staffing and reprioritize noncritical tasks.",
      resolutionStatus: "open",
      relatedProjectId: null,
      relatedCrewId: null,
      relatedEmployeeId: null,
    });
  }

  return conflicts;
}

export function buildScheduleHealth(payload: Pick<SchedulingPayload, "conflicts" | "openShifts" | "assignments" | "dispatch">): SchedulingPayload["health"] {
  const unresolvedConflicts = payload.conflicts.filter((item) => item.resolutionStatus === "open").length;
  const openShifts = payload.openShifts.filter((item) => !item.dismissed).length;
  const understaffedProjects = payload.conflicts.filter((item) => item.type === "understaffed_project" && item.resolutionStatus === "open").length;
  const overstaffedProjects = payload.conflicts.filter((item) => item.type === "overstaffed_project" && item.resolutionStatus === "open").length;
  const overtimeRisks = payload.conflicts.filter((item) => item.type === "overtime_threshold_risk" && item.resolutionStatus === "open").length;
  const certificationRisks = payload.conflicts.filter((item) => item.type === "certification_expired" || item.type === "certification_expiring").length;
  const travelConflicts = payload.conflicts.filter((item) => item.type === "excessive_travel_time" || item.type === "insufficient_travel_buffer").length;
  const lateDispatches = payload.dispatch.filter((item) => item.status === "delayed").length;

  const utilizations = payload.dispatch
    .filter((item) => item.type === "crew" || item.type === "employee")
    .map((item) => item.utilization);

  const meanUtilization = utilizations.length > 0
    ? utilizations.reduce((sum, value) => sum + value, 0) / utilizations.length
    : 0;

  const utilizationVariance = utilizations.length > 0
    ? utilizations.reduce((sum, value) => sum + Math.abs(value - meanUtilization), 0) / utilizations.length
    : 0;

  const utilizationBalancePenalty = Math.round(utilizationVariance / 6);

  const penalties = (unresolvedConflicts * 5)
    + (openShifts * 3)
    + (understaffedProjects * 4)
    + (overstaffedProjects * 2)
    + (overtimeRisks * 3)
    + (certificationRisks * 3)
    + (travelConflicts * 2)
    + (lateDispatches * 3)
    + utilizationBalancePenalty;

  const score = Math.max(0, Math.min(100, 100 - penalties));

  const statusLabel: SchedulingPayload["health"]["statusLabel"] = score >= 90
    ? "Excellent"
    : score >= 75
      ? "Healthy"
      : score >= 60
        ? "Needs Attention"
        : score >= 40
          ? "At Risk"
          : "Critical";

  return {
    score,
    statusLabel,
    breakdown: {
      unresolvedConflicts,
      openShifts,
      understaffedProjects,
      overstaffedProjects,
      overtimeRisks,
      certificationRisks,
      travelConflicts,
      lateDispatches,
      utilizationBalancePenalty,
    },
    biggestRisks: [
      unresolvedConflicts > 0 ? "Unresolved conflicts" : "No unresolved conflicts",
      openShifts > 0 ? "Open shifts requiring staffing" : "Open shift queue stable",
      lateDispatches > 0 ? "Delayed dispatch resources" : "Dispatch punctuality stable",
    ],
    strongestAreas: [
      overtimeRisks <= 2 ? "Overtime risk managed" : "",
      overstaffedProjects <= 1 ? "Low overstaffing" : "",
      travelConflicts <= 1 ? "Travel windows balanced" : "",
    ].filter(Boolean),
    recommendedImprovements: [
      "Resolve critical and high severity conflicts before publish.",
      "Fill urgent open shifts using deterministic recommendations.",
      "Rebalance utilization to keep crew load between 70% and 90%.",
    ],
    isMock: true,
  };
}

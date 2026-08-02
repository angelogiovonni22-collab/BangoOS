import { normalizeAssignmentViews } from "../workforce-normalizer";
import { isActiveCrew, isActiveEmployee, isCurrentMembership } from "../workforce-semantics";
import type { WorkforceAssignmentView } from "../workforce-types";
import type {
  WorkforceAffectedEntity,
  WorkforceDataCompleteness,
  WorkforceDataFreshness,
  WorkforceFreshnessConfig,
  WorkforceIntelligenceEvaluationInput,
  WorkforceSignal,
  WorkforceSignalEvaluationResult,
  WorkforceSignalType,
} from "./workforce-intelligence-types";

const RULE_VERSION = "2.0.0";

const DEFAULT_FRESHNESS: WorkforceFreshnessConfig = {
  workforceRecordStaleAfterHours: 24 * 14,
};

function toTimestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function nowIso(now: Date) {
  return now.toISOString();
}

function stableId(parts: Array<string | number>) {
  return parts.join("::").toLowerCase().replace(/[^a-z0-9:._-]/g, "_");
}

function dedupeEntities(entities: WorkforceAffectedEntity[]) {
  const seen = new Set<string>();
  const ordered: WorkforceAffectedEntity[] = [];

  for (const entity of entities) {
    const key = `${entity.entityType}:${entity.entityId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    ordered.push(entity);
  }

  return ordered;
}

function resolveFreshness(params: {
  updatedAts: Array<string | null | undefined>;
  staleThresholdHours: number;
  evaluatedAt: Date;
}): WorkforceDataFreshness {
  const times = params.updatedAts
    .map((value) => (value ? toTimestamp(value) : null))
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left);

  const latestUpdatedAt = times.length > 0 ? new Date(times[0]).toISOString() : null;
  const ageHours = latestUpdatedAt
    ? (params.evaluatedAt.getTime() - new Date(latestUpdatedAt).getTime()) / (1000 * 60 * 60)
    : Number.POSITIVE_INFINITY;

  return {
    staleThresholdHours: params.staleThresholdHours,
    isStale: ageHours > params.staleThresholdHours,
    latestUpdatedAt,
    evaluatedAt: nowIso(params.evaluatedAt),
  };
}

function overlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  const aStart = toTimestamp(leftStart);
  const aEnd = toTimestamp(leftEnd);
  const bStart = toTimestamp(rightStart);
  const bEnd = toTimestamp(rightEnd);

  if (aStart === null || aEnd === null || bStart === null || bEnd === null) {
    return false;
  }

  return aStart < bEnd && bStart < aEnd;
}

function isMembershipCoveringDate(startsOn: string, endsOn: string | null, isoDateTime: string) {
  const assignmentTime = toTimestamp(isoDateTime);
  const startTime = toTimestamp(`${startsOn}T00:00:00.000Z`);
  const endTime = endsOn ? toTimestamp(`${endsOn}T23:59:59.999Z`) : null;

  if (assignmentTime === null || startTime === null) {
    return false;
  }

  if (assignmentTime < startTime) {
    return false;
  }

  return endTime === null || assignmentTime <= endTime;
}

function intervalsIntersect(startA: number, endA: number, startB: number, endB: number) {
  return startA <= endB && startB <= endA;
}

function membershipIntersectsAssignmentRange(
  membership: { starts_on: string; ends_on: string | null },
  assignment: WorkforceAssignmentView,
) {
  const membershipStart = toTimestamp(`${membership.starts_on}T00:00:00.000Z`);
  const membershipEndValue = membership.ends_on
    ? toTimestamp(`${membership.ends_on}T23:59:59.999Z`)
    : Number.POSITIVE_INFINITY;
  const assignmentStart = toTimestamp(assignment.startsAt);
  const assignmentEnd = toTimestamp(assignment.endsAt);

  if (membershipStart === null || assignmentStart === null || assignmentEnd === null || membershipEndValue === null) {
    return false;
  }

  return intervalsIntersect(membershipStart, membershipEndValue, assignmentStart, assignmentEnd);
}

function buildSignal(params: {
  companyId: string;
  now: Date;
  type: WorkforceSignalType;
  category: WorkforceSignal["category"];
  severity: WorkforceSignal["severity"];
  confidence: number;
  affectedEntities: WorkforceAffectedEntity[];
  evidence: Record<string, unknown>;
  freshness: WorkforceDataFreshness;
  completeness: WorkforceDataCompleteness;
  ruleSuffix: string;
}): WorkforceSignal {
  const ruleId = `workforce.${params.type.toLowerCase()}`;
  const entityScope = dedupeEntities(params.affectedEntities)
    .map((entity) => `${entity.entityType}:${entity.entityId}`)
    .sort();
  const signalId = stableId([
    "signal",
    params.companyId,
    ruleId,
    RULE_VERSION,
    params.ruleSuffix,
    ...entityScope,
  ]);

  return {
    id: signalId,
    companyId: params.companyId,
    domain: "workforce",
    type: params.type,
    category: params.category,
    severity: params.severity,
    confidence: clampConfidence(params.confidence),
    detectedAt: nowIso(params.now),
    affectedEntities: dedupeEntities(params.affectedEntities),
    evidence: params.evidence,
    dataFreshness: params.freshness,
    dataCompleteness: params.completeness,
    ruleId,
    ruleVersion: RULE_VERSION,
  };
}

function filterCompanyRows<T extends { company_id: string }>(rows: T[], companyId: string) {
  return rows.filter((row) => row.company_id === companyId);
}

export function evaluateWorkforceSignals(input: WorkforceIntelligenceEvaluationInput): WorkforceSignalEvaluationResult {
  const now = input.now ?? new Date();
  const freshnessConfig: WorkforceFreshnessConfig = {
    ...DEFAULT_FRESHNESS,
    ...input.freshness,
  };

  const employees = filterCompanyRows(input.employees, input.companyId);
  const crews = filterCompanyRows(input.crews, input.companyId);
  const memberships = filterCompanyRows(input.memberships, input.companyId);
  const assignments = filterCompanyRows(input.assignments, input.companyId);

  const projects = input.projects;
  const phases = input.phases;
  const tasks = input.tasks;

  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const crewById = new Map(crews.map((crew) => [crew.id, crew]));
  const assignmentViews = normalizeAssignmentViews({
    assignments,
    crews,
    employees,
    projects,
    phases,
    tasks,
    profiles: input.profiles,
    now,
  });

  const currentMemberships = memberships.filter((membership) => isCurrentMembership(membership, now));
  const currentMembershipsByEmployee = new Map<string, typeof currentMemberships>();
  const membershipsByCrew = new Map<string, typeof memberships>();

  for (const membership of memberships) {
    const existing = membershipsByCrew.get(membership.crew_id) ?? [];
    existing.push(membership);
    membershipsByCrew.set(membership.crew_id, existing);
  }

  for (const membership of currentMemberships) {
    const existing = currentMembershipsByEmployee.get(membership.employee_id) ?? [];
    existing.push(membership);
    currentMembershipsByEmployee.set(membership.employee_id, existing);
  }

  const liveOrUpcomingAssignments = assignmentViews.filter((assignment) => assignment.bucket !== "completed");
  const liveOrUpcomingAssignmentById = new Map(liveOrUpcomingAssignments.map((assignment) => [assignment.id, assignment]));
  const liveOrUpcomingByEmployee = new Map<string, WorkforceAssignmentView[]>();
  const liveOrUpcomingByCrew = new Map<string, WorkforceAssignmentView[]>();

  for (const assignment of liveOrUpcomingAssignments) {
    if (assignment.employeeId) {
      const employeeAssignments = liveOrUpcomingByEmployee.get(assignment.employeeId) ?? [];
      employeeAssignments.push(assignment);
      liveOrUpcomingByEmployee.set(assignment.employeeId, employeeAssignments);
    }

    if (assignment.crewId) {
      const crewAssignments = liveOrUpcomingByCrew.get(assignment.crewId) ?? [];
      crewAssignments.push(assignment);
      liveOrUpcomingByCrew.set(assignment.crewId, crewAssignments);
    }
  }

  const allUpdatedAt = [
    ...employees.map((employee) => employee.updated_at),
    ...crews.map((crew) => crew.updated_at),
    ...memberships.map((membership) => membership.updated_at),
    ...assignments.map((assignment) => assignment.updated_at),
  ];

  const globalFreshness = resolveFreshness({
    updatedAts: allUpdatedAt,
    staleThresholdHours: freshnessConfig.workforceRecordStaleAfterHours,
    evaluatedAt: now,
  });

  const partialNotices: string[] = [];
  const limitations: WorkforceSignalEvaluationResult["limitations"] = [];

  if (input.availability.projects !== "live") {
    partialNotices.push("Project context is unavailable for workforce relationship checks.");
    limitations.push({
      code: "PROJECT_CONTEXT_UNAVAILABLE",
      message: "Project context is unavailable, so project-linked workforce checks are partial.",
    });
  }

  if (input.availability.phases !== "live") {
    partialNotices.push("Phase context is unavailable for workforce relationship checks.");
    limitations.push({
      code: "PHASE_CONTEXT_UNAVAILABLE",
      message: "Phase context is unavailable, so phase-linked workforce checks are partial.",
    });
  }

  if (input.availability.tasks !== "live") {
    partialNotices.push("Task context is unavailable for workforce relationship checks.");
    limitations.push({
      code: "TASK_CONTEXT_UNAVAILABLE",
      message: "Task context is unavailable, so task-linked workforce checks are partial.",
    });
  }

  if (globalFreshness.isStale) {
    partialNotices.push("Workforce data is stale and some conditions cannot be verified with high confidence.");
  }

  const signals: WorkforceSignal[] = [];

  const addSignal = (signal: WorkforceSignal) => {
    signals.push(signal);
  };

  const stalenessPenalty = globalFreshness.isStale ? 0.25 : 0;

  for (const employee of employees) {
    if (!isActiveEmployee(employee)) {
      continue;
    }

    const directAssignments = (liveOrUpcomingByEmployee.get(employee.id) ?? []).filter((assignment) => assignment.assignmentType === "employee");
    const membershipsForEmployee = currentMembershipsByEmployee.get(employee.id) ?? [];
    const relevantMembershipsForEmployee = memberships
      .filter((membership) => membership.employee_id === employee.id)
      .filter((membership) => membership.status === "active" || membership.status === "planned");

    const hasCrewAssignmentThroughMembership = relevantMembershipsForEmployee.some((membership) => {
      const crewAssignments = (liveOrUpcomingByCrew.get(membership.crew_id) ?? [])
        .filter((assignment) => assignment.assignmentType === "crew");

      return crewAssignments.some((assignment) => membershipIntersectsAssignmentRange(membership, assignment));
    });

    if (directAssignments.length === 0 && !hasCrewAssignmentThroughMembership) {
      const fullName = employee.profile_id
        ? [profileById.get(employee.profile_id)?.first_name?.trim() || "", profileById.get(employee.profile_id)?.last_name?.trim() || ""].filter(Boolean).join(" ") || employee.employee_number
        : employee.employee_number;

      addSignal(buildSignal({
        companyId: input.companyId,
        now,
        type: "ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT",
        category: "coverage",
        severity: "medium",
        confidence: 1 - stalenessPenalty,
        affectedEntities: [{ entityType: "employee", entityId: employee.id, displayName: fullName }],
        evidence: {
          employeeId: employee.id,
          assignmentCount: 0,
          membershipCount: membershipsForEmployee.length,
        },
        freshness: globalFreshness,
        completeness: {
          isComplete: true,
          missingFields: [],
          missingRelationships: [],
        },
        ruleSuffix: employee.id,
      }));
    }

    if (membershipsForEmployee.length === 0) {
      addSignal(buildSignal({
        companyId: input.companyId,
        now,
        type: "EMPLOYEE_WITHOUT_ACTIVE_CREW",
        category: "relationship",
        severity: "medium",
        confidence: 1 - stalenessPenalty,
        affectedEntities: [{ entityType: "employee", entityId: employee.id, displayName: employee.employee_number }],
        evidence: {
          employeeId: employee.id,
          activeMembershipCount: 0,
        },
        freshness: globalFreshness,
        completeness: {
          isComplete: true,
          missingFields: [],
          missingRelationships: [],
        },
        ruleSuffix: employee.id,
      }));
    }
  }

  for (const crew of crews) {
    if (!isActiveCrew(crew)) {
      continue;
    }

    const crewAssignments = (liveOrUpcomingByCrew.get(crew.id) ?? []).filter((assignment) => assignment.assignmentType === "crew");

    if (crewAssignments.length === 0) {
      addSignal(buildSignal({
        companyId: input.companyId,
        now,
        type: "ACTIVE_CREW_WITHOUT_ASSIGNMENT",
        category: "coverage",
        severity: "medium",
        confidence: 1 - stalenessPenalty,
        affectedEntities: [{ entityType: "crew", entityId: crew.id, displayName: crew.name }],
        evidence: {
          crewId: crew.id,
          assignmentCount: 0,
        },
        freshness: globalFreshness,
        completeness: {
          isComplete: true,
          missingFields: [],
          missingRelationships: [],
        },
        ruleSuffix: crew.id,
      }));
    }

    if (!crew.lead_profile_id && !crew.supervisor_profile_id) {
      addSignal(buildSignal({
        companyId: input.companyId,
        now,
        type: "CREW_WITHOUT_ACTIVE_LEAD",
        category: "relationship",
        severity: "low",
        confidence: 1 - stalenessPenalty,
        affectedEntities: [{ entityType: "crew", entityId: crew.id, displayName: crew.name }],
        evidence: {
          crewId: crew.id,
          leadProfileId: crew.lead_profile_id,
          supervisorProfileId: crew.supervisor_profile_id,
        },
        freshness: globalFreshness,
        completeness: {
          isComplete: true,
          missingFields: ["lead_profile_id", "supervisor_profile_id"],
          missingRelationships: [],
        },
        ruleSuffix: crew.id,
      }));
    }
  }

  for (const [employeeId, employeeAssignments] of liveOrUpcomingByEmployee.entries()) {
    const sorted = [...employeeAssignments].sort((left, right) => left.startsAt.localeCompare(right.startsAt));

    for (let index = 0; index < sorted.length; index += 1) {
      const left = sorted[index];
      for (let compareIndex = index + 1; compareIndex < sorted.length; compareIndex += 1) {
        const right = sorted[compareIndex];
        if (!overlap(left.startsAt, left.endsAt, right.startsAt, right.endsAt)) {
          continue;
        }

        addSignal(buildSignal({
          companyId: input.companyId,
          now,
          type: "EMPLOYEE_ASSIGNMENT_OVERLAP",
          category: "conflict",
          severity: "high",
          confidence: 1 - stalenessPenalty,
          affectedEntities: [
            { entityType: "employee", entityId: employeeId, displayName: employeeById.get(employeeId)?.employee_number || employeeId },
            { entityType: "assignment", entityId: left.id, displayName: left.title },
            { entityType: "assignment", entityId: right.id, displayName: right.title },
          ],
          evidence: {
            employeeId,
            assignmentIds: [left.id, right.id],
            windows: [
              { startsAt: left.startsAt, endsAt: left.endsAt },
              { startsAt: right.startsAt, endsAt: right.endsAt },
            ],
          },
          freshness: globalFreshness,
          completeness: {
            isComplete: true,
            missingFields: [],
            missingRelationships: [],
          },
          ruleSuffix: `${employeeId}:${left.id}:${right.id}`,
        }));
      }
    }
  }

  for (const [crewId, crewAssignments] of liveOrUpcomingByCrew.entries()) {
    const sorted = [...crewAssignments].sort((left, right) => left.startsAt.localeCompare(right.startsAt));

    for (let index = 0; index < sorted.length; index += 1) {
      const left = sorted[index];
      for (let compareIndex = index + 1; compareIndex < sorted.length; compareIndex += 1) {
        const right = sorted[compareIndex];
        if (!overlap(left.startsAt, left.endsAt, right.startsAt, right.endsAt)) {
          continue;
        }

        addSignal(buildSignal({
          companyId: input.companyId,
          now,
          type: "CREW_ASSIGNMENT_OVERLAP",
          category: "conflict",
          severity: "high",
          confidence: 1 - stalenessPenalty,
          affectedEntities: [
            { entityType: "crew", entityId: crewId, displayName: crewById.get(crewId)?.name || crewId },
            { entityType: "assignment", entityId: left.id, displayName: left.title },
            { entityType: "assignment", entityId: right.id, displayName: right.title },
          ],
          evidence: {
            crewId,
            assignmentIds: [left.id, right.id],
          },
          freshness: globalFreshness,
          completeness: {
            isComplete: true,
            missingFields: [],
            missingRelationships: [],
          },
          ruleSuffix: `${crewId}:${left.id}:${right.id}`,
        }));
      }
    }
  }

  const projectIds = new Set(projects.map((project) => project.id));
  const phaseIds = new Set(phases.map((phase) => phase.id));
  const taskIds = new Set(tasks.map((task) => task.id));

  for (const assignment of assignments) {
    const assignmentView = liveOrUpcomingAssignmentById.get(assignment.id);
    if (!assignmentView) {
      continue;
    }

    const missingRelationships: string[] = [];
    const missingFields: string[] = [];

    if (assignment.assignment_type === "crew") {
      if (!assignment.crew_id) {
        missingFields.push("crew_id");
      } else if (!crewById.has(assignment.crew_id)) {
        missingRelationships.push("crew");
      }
    }

    if (assignment.assignment_type === "employee") {
      if (!assignment.employee_id) {
        missingFields.push("employee_id");
      } else if (!employeeById.has(assignment.employee_id)) {
        missingRelationships.push("employee");
      }
    }

    if (missingFields.length > 0 || missingRelationships.length > 0) {
      addSignal(buildSignal({
        companyId: input.companyId,
        now,
        type: "ASSIGNMENT_MISSING_REQUIRED_ENTITY",
        category: "data_quality",
        severity: "high",
        confidence: 0.95 - stalenessPenalty,
        affectedEntities: [{ entityType: "assignment", entityId: assignment.id, displayName: assignment.title }],
        evidence: {
          assignmentId: assignment.id,
          assignmentType: assignment.assignment_type,
          missingFields,
          missingRelationships,
        },
        freshness: globalFreshness,
        completeness: {
          isComplete: false,
          missingFields,
          missingRelationships,
        },
        ruleSuffix: assignment.id,
      }));
    }

    const projectUnavailable = input.availability.projects !== "live";
    const projectMissing = !projectUnavailable && !projectIds.has(assignment.project_id);

    if (projectMissing) {
      addSignal(buildSignal({
        companyId: input.companyId,
        now,
        type: "ASSIGNMENT_MISSING_PROJECT_CONTEXT",
        category: "data_quality",
        severity: "medium",
        confidence: 0.9,
        affectedEntities: [{ entityType: "assignment", entityId: assignment.id, displayName: assignment.title }],
        evidence: {
          assignmentId: assignment.id,
          projectId: assignment.project_id,
          projectContextAvailable: true,
        },
        freshness: globalFreshness,
        completeness: {
          isComplete: true,
          missingFields: [],
          missingRelationships: ["project"],
        },
        ruleSuffix: `${assignment.id}:${assignment.project_id}`,
      }));
    }

    const relationshipMissing: string[] = [];
    if (assignment.phase_id && input.availability.phases === "live" && !phaseIds.has(assignment.phase_id)) {
      relationshipMissing.push("phase");
    }
    if (assignment.task_id && input.availability.tasks === "live" && !taskIds.has(assignment.task_id)) {
      relationshipMissing.push("task");
    }
    if (assignment.task_id && input.availability.tasks !== "live") {
      relationshipMissing.push("task_context");
    }
    if (assignment.phase_id && input.availability.phases !== "live") {
      relationshipMissing.push("phase_context");
    }

    if (relationshipMissing.length > 0) {
      addSignal(buildSignal({
        companyId: input.companyId,
        now,
        type: "INCOMPLETE_WORKFORCE_RELATIONSHIP",
        category: "data_quality",
        severity: "medium",
        confidence: relationshipMissing.some((item) => item.endsWith("_context")) ? 0.6 : 0.9,
        affectedEntities: [{ entityType: "assignment", entityId: assignment.id, displayName: assignment.title }],
        evidence: {
          assignmentId: assignment.id,
          missingRelationships: relationshipMissing,
        },
        freshness: globalFreshness,
        completeness: {
          isComplete: false,
          missingFields: [],
          missingRelationships: relationshipMissing,
        },
        ruleSuffix: `${assignment.id}:${relationshipMissing.join("-")}`,
      }));
    }

    if (assignmentView.bucket === "upcoming" && assignment.assignment_type === "crew" && assignment.crew_id) {
      const membershipsForCrew = membershipsByCrew.get(assignment.crew_id) ?? [];
      const staffed = membershipsForCrew.some((membership) => {
        if (membership.status !== "active" && membership.status !== "planned") {
          return false;
        }

        return isMembershipCoveringDate(membership.starts_on, membership.ends_on, assignment.starts_at);
      });

      if (!staffed) {
        addSignal(buildSignal({
          companyId: input.companyId,
          now,
          type: "UPCOMING_ASSIGNMENT_WITHOUT_STAFFING",
          category: "coverage",
          severity: "high",
          confidence: 0.95 - stalenessPenalty,
          affectedEntities: [
            { entityType: "assignment", entityId: assignment.id, displayName: assignment.title },
            { entityType: "crew", entityId: assignment.crew_id, displayName: crewById.get(assignment.crew_id)?.name || assignment.crew_id },
          ],
          evidence: {
            assignmentId: assignment.id,
            crewId: assignment.crew_id,
            staffingMembershipCount: membershipsForCrew.length,
            assignmentStartsAt: assignment.starts_at,
          },
          freshness: globalFreshness,
          completeness: {
            isComplete: true,
            missingFields: [],
            missingRelationships: [],
          },
          ruleSuffix: `${assignment.id}:${assignment.crew_id}`,
        }));
      }
    }
  }

  for (const employee of employees) {
    if (!employee.primary_crew_id) {
      continue;
    }

    if (!crewById.has(employee.primary_crew_id)) {
      addSignal(buildSignal({
        companyId: input.companyId,
        now,
        type: "INCOMPLETE_WORKFORCE_RELATIONSHIP",
        category: "data_quality",
        severity: "medium",
        confidence: 0.9,
        affectedEntities: [{ entityType: "employee", entityId: employee.id, displayName: employee.employee_number }],
        evidence: {
          employeeId: employee.id,
          missingRelationships: ["primary_crew"],
        },
        freshness: globalFreshness,
        completeness: {
          isComplete: false,
          missingFields: [],
          missingRelationships: ["primary_crew"],
        },
        ruleSuffix: `${employee.id}:${employee.primary_crew_id}`,
      }));
    }
  }

  const staleRows = [
    ...employees.map((employee) => ({
      id: employee.id,
      label: employee.employee_number,
      updatedAt: employee.updated_at,
      entityType: "employee" as const,
    })),
    ...crews.map((crew) => ({
      id: crew.id,
      label: crew.name,
      updatedAt: crew.updated_at,
      entityType: "crew" as const,
    })),
    ...assignments.map((assignment) => ({
      id: assignment.id,
      label: assignment.title,
      updatedAt: assignment.updated_at,
      entityType: "assignment" as const,
    })),
    ...memberships.map((membership) => ({
      id: membership.id,
      label: membership.role,
      updatedAt: membership.updated_at,
      entityType: "membership" as const,
    })),
  ];

  for (const staleRow of staleRows) {
    const freshness = resolveFreshness({
      updatedAts: [staleRow.updatedAt],
      staleThresholdHours: freshnessConfig.workforceRecordStaleAfterHours,
      evaluatedAt: now,
    });

    if (!freshness.isStale) {
      continue;
    }

    addSignal(buildSignal({
      companyId: input.companyId,
      now,
      type: "STALE_WORKFORCE_RECORD",
      category: "data_quality",
      severity: "low",
      confidence: 1,
      affectedEntities: [{ entityType: staleRow.entityType, entityId: staleRow.id, displayName: staleRow.label }],
      evidence: {
        staleEntityType: staleRow.entityType,
        staleEntityId: staleRow.id,
        lastUpdatedAt: staleRow.updatedAt,
      },
      freshness,
      completeness: {
        isComplete: true,
        missingFields: [],
        missingRelationships: [],
      },
      ruleSuffix: `${staleRow.entityType}:${staleRow.id}`,
    }));
  }

  if (globalFreshness.isStale) {
    addSignal(buildSignal({
      companyId: input.companyId,
      now,
      type: "WORKFORCE_CONDITION_UNVERIFIABLE_STALE_DATA",
      category: "data_quality",
      severity: "medium",
      confidence: 0.75,
      affectedEntities: [{ entityType: "workspace", entityId: input.companyId, displayName: null }],
      evidence: {
        companyId: input.companyId,
        latestUpdatedAt: globalFreshness.latestUpdatedAt,
        staleThresholdHours: globalFreshness.staleThresholdHours,
      },
      freshness: globalFreshness,
      completeness: {
        isComplete: false,
        missingFields: [],
        missingRelationships: ["fresh_updates"],
      },
      ruleSuffix: input.companyId,
    }));
  }

  return {
    signals,
    partialNotices,
    limitations,
  };
}

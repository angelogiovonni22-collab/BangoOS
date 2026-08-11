import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createWorkforceRepository } from "@/lib/workforce/workforce-repository";
import type { Database } from "@/types/database.types";
import type {
  WorkforceAssignmentRow,
  WorkforceCrewRow,
  WorkforceEmployeeRow,
  WorkforceEquipmentRow,
  WorkforceMembershipRow,
  WorkforcePhaseRow,
  WorkforceProfileRow,
  WorkforceProjectRow,
  WorkforceTaskRow,
} from "@/lib/workforce/workforce-types";
import { buildScheduleHealth, detectSchedulingConflicts } from "./conflict-engine";
import { buildAvailableContractorsOrVendors } from "./contractor-vendor-availability";
import type { SchedulingService } from "./service";
import type {
  AssignmentDraft,
  AssignmentStatus,
  DispatchResource,
  DispatchStatus,
  OpenShift,
  ResourceAvailability,
  ScheduleAssignment,
  ScheduleConflict,
  SchedulingInsight,
  SchedulingPayload,
  TimeOffEntry,
} from "./types";

type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];
type TradePartnerAssignmentRow = Database["public"]["Tables"]["trade_partner_assignments"]["Row"];

type SchedulingEventRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown> | null;
  occurred_at: string;
};

type LoadedRows = {
  assignments: WorkforceAssignmentRow[];
  projects: WorkforceProjectRow[];
  phases: WorkforcePhaseRow[];
  tasks: WorkforceTaskRow[];
  crews: WorkforceCrewRow[];
  employees: WorkforceEmployeeRow[];
  memberships: WorkforceMembershipRow[];
  profiles: WorkforceProfileRow[];
  equipment: WorkforceEquipmentRow[];
  vendors: VendorRow[];
  tradePartnerAssignments: TradePartnerAssignmentRow[];
  events: SchedulingEventRow[];
};

type EventStateMaps = {
  dispatchByResource: Map<string, DispatchStatus>;
  openShiftDismissedById: Map<string, boolean>;
  conflictResolutionById: Map<string, ScheduleConflict["resolutionStatus"]>;
  insightStatusById: Map<string, SchedulingInsight["status"]>;
};

type SchedulingSupabaseClient = NonNullable<ReturnType<typeof createClient>>;

function toIsoDate(iso: string) {
  return iso.slice(0, 10);
}

function toTime(iso: string) {
  return iso.slice(11, 16);
}

function combineDateAndTime(date: string, time: string) {
  return `${date}T${time}:00Z`;
}

function durationHours(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const hours = (end - start) / (1000 * 60 * 60);
  if (!Number.isFinite(hours) || hours < 0) {
    return 0;
  }

  return Number(hours.toFixed(2));
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aStartMs = new Date(aStart).getTime();
  const aEndMs = new Date(aEnd).getTime();
  const bStartMs = new Date(bStart).getTime();
  const bEndMs = new Date(bEnd).getTime();
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

function mapAssignmentType(sourceType: WorkforceAssignmentRow["source_type"], assignmentType: WorkforceAssignmentRow["assignment_type"]): ScheduleAssignment["type"] {
  if (sourceType === "task" || sourceType === "schedule") {
    return "project_work";
  }

  if (sourceType === "project") {
    return "milestone";
  }

  if (assignmentType === "crew") {
    return "crew_mobilization";
  }

  return "project_work";
}

function mapAssignmentStatus(status: WorkforceAssignmentRow["status"]): AssignmentStatus {
  if (status === "planned") {
    return "draft";
  }

  if (status === "confirmed") {
    return "published";
  }

  return status;
}

function mapDraftStatus(status: AssignmentDraft["status"]): WorkforceAssignmentRow["status"] {
  if (status === "draft") {
    return "planned";
  }

  if (status === "published") {
    return "confirmed";
  }

  return status;
}

function mapShift(start: string): "day" | "swing" | "night" {
  const hour = Number.parseInt(start.slice(11, 13), 10);
  if (Number.isNaN(hour)) {
    return "day";
  }

  if (hour >= 5 && hour < 14) {
    return "day";
  }

  if (hour >= 14 && hour < 21) {
    return "swing";
  }

  return "night";
}

function mapPriority(status: WorkforceAssignmentRow["status"]): "low" | "medium" | "high" | "critical" {
  if (status === "in_progress") {
    return "high";
  }

  if (status === "completed" || status === "cancelled") {
    return "low";
  }

  return "medium";
}

function mapDispatchStatusFromAssignment(assignment: ScheduleAssignment | null): DispatchStatus {
  if (!assignment) {
    return "available";
  }

  if (assignment.status === "completed") {
    return "completed";
  }

  if (assignment.status === "cancelled") {
    return "off_shift";
  }

  if (assignment.status === "in_progress") {
    return "on_site";
  }

  return "assigned";
}

function mapDispatchStatusToAssignmentStatus(status: DispatchStatus): WorkforceAssignmentRow["status"] | null {
  if (status === "assigned") {
    return "confirmed";
  }

  if (status === "in_transit" || status === "on_site") {
    return "in_progress";
  }

  if (status === "completed") {
    return "completed";
  }

  if (status === "off_shift") {
    return "cancelled";
  }

  return null;
}

function profileNameMap(profiles: WorkforceProfileRow[]) {
  return new Map(
    profiles.map((profile) => {
      const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
      return [profile.id, fullName];
    }),
  );
}

function toEventStateMaps(events: SchedulingEventRow[]): EventStateMaps {
  const dispatchByResource = new Map<string, DispatchStatus>();
  const openShiftDismissedById = new Map<string, boolean>();
  const conflictResolutionById = new Map<string, ScheduleConflict["resolutionStatus"]>();
  const insightStatusById = new Map<string, SchedulingInsight["status"]>();

  const ordered = [...events].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  for (const event of ordered) {
    const payload = event.payload ?? {};

    if (event.event_type === "workforce.dispatch.status.updated") {
      const resourceType = typeof payload.resource_type === "string" ? payload.resource_type : event.entity_type;
      const nextStatus = typeof payload.dispatch_status === "string" ? payload.dispatch_status : "";
      if ((resourceType === "crew" || resourceType === "employee" || resourceType === "equipment")
        && (nextStatus === "available" || nextStatus === "assigned" || nextStatus === "in_transit" || nextStatus === "on_site" || nextStatus === "delayed" || nextStatus === "completed" || nextStatus === "off_shift")) {
        dispatchByResource.set(`${resourceType}:${event.entity_id}`, nextStatus);
      }
    }

    if (event.event_type === "workforce.scheduling.open_shift.updated") {
      const openShiftId = typeof payload.open_shift_id === "string" ? payload.open_shift_id : "";
      const dismissed = Boolean(payload.dismissed);
      if (openShiftId) {
        openShiftDismissedById.set(openShiftId, dismissed);
      }
    }

    if (event.event_type === "workforce.scheduling.conflict.resolution.updated") {
      const conflictId = typeof payload.conflict_id === "string" ? payload.conflict_id : "";
      const status = typeof payload.resolution_status === "string" ? payload.resolution_status : "";
      if (conflictId && (status === "open" || status === "acknowledged" || status === "dismissed" || status === "resolved")) {
        conflictResolutionById.set(conflictId, status);
      }
    }

    if (event.event_type === "workforce.scheduling.insight.status.updated") {
      const insightId = typeof payload.insight_id === "string" ? payload.insight_id : "";
      const status = typeof payload.insight_status === "string" ? payload.insight_status : "";
      if (insightId && (status === "open" || status === "accepted" || status === "dismissed")) {
        insightStatusById.set(insightId, status);
      }
    }
  }

  return {
    dispatchByResource,
    openShiftDismissedById,
    conflictResolutionById,
    insightStatusById,
  };
}

function toScheduleAssignment(
  row: WorkforceAssignmentRow,
  projects: Map<string, WorkforceProjectRow>,
  phases: Map<string, WorkforcePhaseRow>,
  tasks: Map<string, WorkforceTaskRow>,
  crews: Map<string, WorkforceCrewRow>,
  employees: Map<string, WorkforceEmployeeRow>,
  profileNames: Map<string, string>,
  crewMembershipsByCrew: Map<string, WorkforceMembershipRow[]>,
): ScheduleAssignment {
  const project = projects.get(row.project_id);
  const phase = row.phase_id ? phases.get(row.phase_id) : null;
  const task = row.task_id ? tasks.get(row.task_id) : null;
  const crew = row.crew_id ? crews.get(row.crew_id) : null;
  const employee = row.employee_id ? employees.get(row.employee_id) : null;

  const membershipEmployeeIds = crew?.id
    ? (crewMembershipsByCrew.get(crew.id) ?? []).map((membership) => membership.employee_id)
    : [];

  const employeeIds = row.employee_id ? [row.employee_id] : membershipEmployeeIds;
  const requiredTrade = employee?.trade ?? "";
  const location = phase?.name ?? task?.title ?? "";
  const supervisorName = crew?.supervisor_profile_id ? profileNames.get(crew.supervisor_profile_id) ?? "" : "";

  return {
    id: row.id,
    title: row.title,
    type: mapAssignmentType(row.source_type, row.assignment_type),
    status: mapAssignmentStatus(row.status),
    shift: mapShift(row.starts_at),
    priority: mapPriority(row.status),
    date: toIsoDate(row.starts_at),
    startTime: toTime(row.starts_at),
    endTime: toTime(row.ends_at),
    plannedStart: row.starts_at,
    plannedEnd: row.ends_at,
    plannedLaborHours: Number(row.planned_hours ?? 0),
    requiredHeadcount: Math.max(employeeIds.length, row.assignment_type === "crew" ? 1 : 0),
    requiredTrade,
    assignedCrewIds: row.crew_id ? [row.crew_id] : [],
    assignedEmployeeIds: employeeIds,
    scope: {
      projectId: row.project_id,
      projectName: project?.name ?? "",
      location,
      supervisor: supervisorName,
    },
    notes: row.notes ?? row.description ?? row.source_id ?? "",
    travelTimeMinutes: 0,
    recurrence: {
      enabled: false,
      frequency: "weekly",
      interval: 1,
      endDate: null,
    },
    safetyRequirement: "",
    certificationRequirement: "",
    equipment: {
      requiredEquipment: [],
      assignedEquipment: [],
      operatorRequired: false,
    },
    isOpenShift: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildTradeOptions(employees: WorkforceEmployeeRow[]) {
  const unique = new Set<string>();
  for (const employee of employees) {
    const trade = employee.trade?.trim();
    if (trade) {
      unique.add(trade);
    }
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

function buildTimeOffFromEmployees(employees: WorkforceEmployeeRow[], profileNames: Map<string, string>, periodDate: string): TimeOffEntry[] {
  const start = `${periodDate}T00:00:00Z`;
  const end = `${periodDate}T23:59:59Z`;

  return employees
    .filter((employee) => employee.availability_status === "unavailable" || employee.availability_status === "restricted" || employee.employment_status === "leave")
    .map((employee) => ({
      id: `pto-${employee.id}-${periodDate}`,
      employeeId: employee.id,
      employeeName: employee.profile_id ? profileNames.get(employee.profile_id) ?? employee.employee_number : employee.employee_number,
      type: employee.employment_status === "leave" ? "pto" : "unavailable",
      start,
      end,
      partialDay: false,
      reason: employee.availability_status === "restricted" ? "Restricted availability" : "Unavailable",
    }));
}

function buildAvailability(
  assignments: ScheduleAssignment[],
  employees: WorkforceEmployeeRow[],
  crews: WorkforceCrewRow[],
  profileNames: Map<string, string>,
): ResourceAvailability[] {
  const activeEmployeeIds = new Set(assignments.flatMap((assignment) => assignment.assignedEmployeeIds));
  const activeCrewIds = new Set(assignments.flatMap((assignment) => assignment.assignedCrewIds));

  const employeeAvailability: ResourceAvailability[] = employees.map((employee) => {
    const employeeName = employee.profile_id ? profileNames.get(employee.profile_id) ?? employee.employee_number : employee.employee_number;
    const assigned = activeEmployeeIds.has(employee.id);
    const restricted = employee.availability_status === "restricted";
    const unavailable = employee.availability_status === "unavailable" || employee.employment_status === "leave" || employee.employment_status === "terminated";

    return {
      id: `availability-employee-${employee.id}`,
      resourceType: "employee",
      resourceId: employee.id,
      name: employeeName,
      trade: employee.trade ?? "",
      location: "",
      shift: "day",
      availability: unavailable ? "unavailable" : restricted ? "partial" : assigned ? "partial" : "available",
      availableFrom: "06:00",
      availableTo: "18:00",
      overtimeEligible: !unavailable,
      certificationSummary: "",
      utilization: assigned ? 80 : 20,
    };
  });

  const crewAvailability: ResourceAvailability[] = crews.map((crew) => ({
    id: `availability-crew-${crew.id}`,
    resourceType: "crew",
    resourceId: crew.id,
    name: crew.name,
    trade: "",
    location: crew.home_location ?? "",
    shift: "day",
    availability: crew.status !== "active" ? "unavailable" : activeCrewIds.has(crew.id) ? "partial" : "available",
    availableFrom: "06:00",
    availableTo: "18:00",
    overtimeEligible: crew.status === "active",
    certificationSummary: "",
    utilization: activeCrewIds.has(crew.id) ? 85 : 15,
  }));

  return [...employeeAvailability, ...crewAvailability];
}

function toResourceCurrentAssignment(assignments: ScheduleAssignment[], predicate: (assignment: ScheduleAssignment) => boolean) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const candidates = assignments.filter((assignment) => predicate(assignment));
  const sameDay = candidates.filter((assignment) => assignment.date === today);

  if (sameDay.length > 0) {
    return sameDay.sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null;
  }

  const upcoming = candidates
    .filter((assignment) => new Date(assignment.plannedStart).getTime() >= now.getTime())
    .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));

  return upcoming[0] ?? candidates.sort((a, b) => b.plannedStart.localeCompare(a.plannedStart))[0] ?? null;
}

function buildDispatchResources(
  assignments: ScheduleAssignment[],
  crews: WorkforceCrewRow[],
  employees: WorkforceEmployeeRow[],
  equipment: WorkforceEquipmentRow[],
  profiles: Map<string, string>,
  events: EventStateMaps,
): DispatchResource[] {
  const resources: DispatchResource[] = [];

  for (const crew of crews) {
    const current = toResourceCurrentAssignment(assignments, (assignment) => assignment.assignedCrewIds.includes(crew.id));
    const key = `crew:${crew.id}`;
    const status = events.dispatchByResource.get(key) ?? mapDispatchStatusFromAssignment(current);

    resources.push({
      id: key,
      type: "crew",
      resourceId: crew.id,
      name: crew.name,
      trade: "",
      specialty: "",
      status,
      currentAssignmentId: current?.id ?? null,
      currentAssignmentTitle: current?.title ?? null,
      destination: current?.scope.location ?? crew.home_location ?? "",
      shift: current?.shift ?? "day",
      startTime: current?.startTime ?? "06:00",
      estimatedTravelMinutes: current?.travelTimeMinutes ?? 0,
      utilization: current ? 85 : 20,
      alerts: status === "delayed" ? ["Dispatch delay"] : [],
      certificationWarnings: [],
      contact: crew.supervisor_profile_id ? profiles.get(crew.supervisor_profile_id) ?? "" : "",
      relatedProjectId: current?.scope.projectId ?? null,
      relatedProjectName: current?.scope.projectName ?? null,
      delayReason: status === "delayed" ? "Manual delay" : null,
    });
  }

  for (const employee of employees) {
    const current = toResourceCurrentAssignment(assignments, (assignment) => assignment.assignedEmployeeIds.includes(employee.id));
    const key = `employee:${employee.id}`;
    const status = events.dispatchByResource.get(key)
      ?? (employee.availability_status === "unavailable" || employee.employment_status === "leave" ? "off_shift" : mapDispatchStatusFromAssignment(current));
    const name = employee.profile_id ? profiles.get(employee.profile_id) ?? employee.employee_number : employee.employee_number;

    resources.push({
      id: key,
      type: "employee",
      resourceId: employee.id,
      name,
      trade: employee.trade ?? "",
      specialty: employee.position_title,
      status,
      currentAssignmentId: current?.id ?? null,
      currentAssignmentTitle: current?.title ?? null,
      destination: current?.scope.location ?? "",
      shift: current?.shift ?? "day",
      startTime: current?.startTime ?? "06:00",
      estimatedTravelMinutes: current?.travelTimeMinutes ?? 0,
      utilization: current ? 80 : 10,
      alerts: status === "delayed" ? ["Dispatch delay"] : [],
      certificationWarnings: [],
      contact: "",
      relatedProjectId: current?.scope.projectId ?? null,
      relatedProjectName: current?.scope.projectName ?? null,
      delayReason: status === "delayed" ? "Manual delay" : null,
    });
  }

  for (const item of equipment) {
    const current = toResourceCurrentAssignment(assignments, (assignment) => {
      if (item.assigned_job_id && assignment.scope.projectId === item.assigned_job_id) {
        return true;
      }

      if (item.assigned_crew_id && assignment.assignedCrewIds.includes(item.assigned_crew_id)) {
        return true;
      }

      if (item.assigned_employee_id && assignment.assignedEmployeeIds.includes(item.assigned_employee_id)) {
        return true;
      }

      return false;
    });

    const key = `equipment:${item.id}`;
    const maintenanceIssue = item.maintenance_status.toLowerCase().includes("due") || item.maintenance_status.toLowerCase().includes("overdue");
    const defaultStatus: DispatchStatus = item.status === "active"
      ? (current ? "assigned" : "available")
      : "off_shift";

    const status = events.dispatchByResource.get(key) ?? defaultStatus;
    const alerts: string[] = [];
    if (maintenanceIssue) {
      alerts.push("Maintenance conflict");
    }
    if (status === "delayed") {
      alerts.push("Dispatch delay");
    }

    resources.push({
      id: key,
      type: "equipment",
      resourceId: item.id,
      name: item.name,
      trade: "Equipment",
      specialty: item.equipment_number,
      status,
      currentAssignmentId: current?.id ?? null,
      currentAssignmentTitle: current?.title ?? null,
      destination: current?.scope.location ?? "",
      shift: current?.shift ?? "day",
      startTime: current?.startTime ?? "06:00",
      estimatedTravelMinutes: current?.travelTimeMinutes ?? 0,
      utilization: current ? 75 : 15,
      alerts,
      certificationWarnings: [],
      contact: "",
      relatedProjectId: current?.scope.projectId ?? item.assigned_job_id,
      relatedProjectName: current?.scope.projectName ?? null,
      delayReason: status === "delayed" ? "Manual delay" : null,
    });
  }

  return resources;
}

function buildOpenShifts(
  assignments: ScheduleAssignment[],
  availability: ResourceAvailability[],
  events: EventStateMaps,
): OpenShift[] {
  const employeeCandidates = availability.filter((item) => item.resourceType === "employee" && item.availability === "available");
  const crewCandidates = availability.filter((item) => item.resourceType === "crew" && item.availability === "available");

  return assignments
    .filter((assignment) => assignment.status !== "completed" && assignment.status !== "cancelled")
    .filter((assignment) => assignment.requiredHeadcount > assignment.assignedEmployeeIds.length || assignment.assignedCrewIds.length === 0)
    .map((assignment) => {
      const workersNeeded = Math.max(1, assignment.requiredHeadcount - assignment.assignedEmployeeIds.length);
      const matchingEmployees = employeeCandidates
        .filter((candidate) => !assignment.requiredTrade || !candidate.trade || candidate.trade === assignment.requiredTrade)
        .map((candidate) => candidate.resourceId)
        .slice(0, 8);

      const matchingCrews = crewCandidates
        .filter((candidate) => !assignment.requiredTrade || !candidate.trade || candidate.trade === assignment.requiredTrade)
        .map((candidate) => candidate.resourceId)
        .slice(0, 6);

      const openShiftId = `open-${assignment.id}`;

      return {
        id: openShiftId,
        assignmentId: assignment.id,
        projectId: assignment.scope.projectId,
        projectName: assignment.scope.projectName,
        tradeRequired: assignment.requiredTrade,
        workersNeeded,
        date: assignment.date,
        shift: assignment.shift,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        location: assignment.scope.location,
        urgency: assignment.priority,
        supervisor: assignment.scope.supervisor,
        certificationRequirements: assignment.certificationRequirement ? [assignment.certificationRequirement] : [],
        estimatedHours: assignment.plannedLaborHours,
        reason: "Coverage gap",
        candidateEmployeeIds: matchingEmployees,
        candidateCrewIds: matchingCrews,
        dismissed: events.openShiftDismissedById.get(openShiftId) ?? false,
      } satisfies OpenShift;
    });
}

function applyConflictResolutions(conflicts: ScheduleConflict[], events: EventStateMaps) {
  return conflicts.map((conflict) => {
    const resolution = events.conflictResolutionById.get(conflict.id);
    if (!resolution) {
      return conflict;
    }

    return {
      ...conflict,
      resolutionStatus: resolution,
    };
  });
}

function buildInsights(conflicts: ScheduleConflict[], openShifts: OpenShift[], events: EventStateMaps): SchedulingInsight[] {
  const insights: SchedulingInsight[] = [];

  const criticalConflicts = conflicts
    .filter((conflict) => conflict.resolutionStatus === "open")
    .sort((left, right) => left.severity.localeCompare(right.severity))
    .slice(0, 4);

  for (const conflict of criticalConflicts) {
    const id = `insight-conflict-${conflict.id}`;
    insights.push({
      id,
      title: conflict.title,
      category: "conflict",
      severity: conflict.severity,
      explanation: conflict.explanation,
      expectedImpact: conflict.recommendedAction,
      affectedResources: conflict.affectedResources,
      recommendedAction: conflict.recommendedAction,
      confidence: 0.82,
      status: events.insightStatusById.get(id) ?? "open",
    });
  }

  for (const shift of openShifts.filter((item) => !item.dismissed).slice(0, 3)) {
    const id = `insight-open-shift-${shift.id}`;
    insights.push({
      id,
      title: `Fill open shift: ${shift.projectName}`,
      category: "staffing",
      severity: shift.urgency === "critical" ? "critical" : shift.urgency === "high" ? "high" : "medium",
      explanation: `${shift.workersNeeded} workers needed for ${shift.tradeRequired || "field work"}.`,
      expectedImpact: "Reduces schedule slip risk and dispatch delays.",
      affectedResources: [shift.projectId],
      recommendedAction: "Assign candidate crew or employee from available pool.",
      confidence: 0.79,
      status: events.insightStatusById.get(id) ?? "open",
    });
  }

  return insights;
}

function summarize(
  assignments: ScheduleAssignment[],
  conflicts: ScheduleConflict[],
  openShifts: OpenShift[],
  availability: ResourceAvailability[],
): SchedulingPayload["summary"] {
  const employeesScheduled = assignments.reduce((sum, assignment) => sum + assignment.assignedEmployeeIds.length, 0);
  const crewsAssigned = new Set(assignments.flatMap((assignment) => assignment.assignedCrewIds)).size;
  const availableEmployees = availability.filter((item) => item.resourceType === "employee" && item.availability === "available").length;
  const availableCrews = availability.filter((item) => item.resourceType === "crew" && item.availability === "available").length;
  const openShiftCount = openShifts.filter((item) => !item.dismissed).length;
  const unresolvedConflicts = conflicts.filter((item) => item.resolutionStatus === "open").length;
  const overtimeRisk = conflicts.filter((item) => item.type === "overtime_threshold_risk" && item.resolutionStatus === "open").length;
  const understaffed = conflicts.filter((item) => item.type === "understaffed_project" && item.resolutionStatus === "open").length;
  const overstaffed = conflicts.filter((item) => item.type === "overstaffed_project" && item.resolutionStatus === "open").length;

  return {
    dateRangeLabel: "scheduling.dateRange.currentWeek",
    operationalSummary: "scheduling.summary.operational",
    companyContext: "",
    branchContext: "",
    kpis: [
      {
        id: "employeesScheduled",
        labelKey: "scheduling.kpi.employeesScheduled",
        value: String(employeesScheduled),
        insightKey: "scheduling.kpiInsight.employeesScheduled",
        trendKey: "scheduling.kpiTrend.employeesScheduled",
        status: employeesScheduled > 0 ? "good" : "watch",
      },
      {
        id: "crewsAssigned",
        labelKey: "scheduling.kpi.crewsAssigned",
        value: String(crewsAssigned),
        insightKey: "scheduling.kpiInsight.crewsAssigned",
        trendKey: "scheduling.kpiTrend.crewsAssigned",
        status: crewsAssigned > 0 ? "good" : "watch",
      },
      {
        id: "availableEmployees",
        labelKey: "scheduling.kpi.availableEmployees",
        value: String(availableEmployees),
        insightKey: "scheduling.kpiInsight.availableEmployees",
        trendKey: "scheduling.kpiTrend.availableEmployees",
        status: availableEmployees > 0 ? "good" : "watch",
      },
      {
        id: "availableCrews",
        labelKey: "scheduling.kpi.availableCrews",
        value: String(availableCrews),
        insightKey: "scheduling.kpiInsight.availableCrews",
        trendKey: "scheduling.kpiTrend.availableCrews",
        status: availableCrews > 0 ? "good" : "watch",
      },
      {
        id: "openShifts",
        labelKey: "scheduling.kpi.openShifts",
        value: String(openShiftCount),
        insightKey: "scheduling.kpiInsight.openShifts",
        trendKey: "scheduling.kpiTrend.openShifts",
        status: openShiftCount > 0 ? "watch" : "good",
      },
      {
        id: "conflicts",
        labelKey: "scheduling.kpi.conflicts",
        value: String(unresolvedConflicts),
        insightKey: "scheduling.kpiInsight.conflicts",
        trendKey: "scheduling.kpiTrend.conflicts",
        status: unresolvedConflicts > 0 ? "watch" : "good",
      },
      {
        id: "overtimeRisk",
        labelKey: "scheduling.kpi.overtimeRisk",
        value: String(overtimeRisk),
        insightKey: "scheduling.kpiInsight.overtimeRisk",
        trendKey: "scheduling.kpiTrend.overtimeRisk",
        status: overtimeRisk > 0 ? "watch" : "good",
      },
      {
        id: "understaffedProjects",
        labelKey: "scheduling.kpi.understaffedProjects",
        value: String(understaffed),
        insightKey: "scheduling.kpiInsight.understaffedProjects",
        trendKey: "scheduling.kpiTrend.understaffedProjects",
        status: understaffed > 0 ? "watch" : "good",
      },
      {
        id: "overstaffedProjects",
        labelKey: "scheduling.kpi.overstaffedProjects",
        value: String(overstaffed),
        insightKey: "scheduling.kpiInsight.overstaffedProjects",
        trendKey: "scheduling.kpiTrend.overstaffedProjects",
        status: overstaffed > 0 ? "watch" : "good",
      },
      {
        id: "scheduleHealth",
        labelKey: "scheduling.kpi.scheduleHealth",
        value: "0%",
        insightKey: "scheduling.kpiInsight.scheduleHealth",
        trendKey: "scheduling.kpiTrend.scheduleHealth",
        status: "watch",
      },
    ],
  };
}

function buildAnalytics(
  assignments: ScheduleAssignment[],
  conflicts: ScheduleConflict[],
  openShifts: OpenShift[],
  dispatch: DispatchResource[],
): SchedulingPayload["analytics"] {
  const totalAssignments = assignments.length;
  const totalScheduled = assignments.reduce((sum, assignment) => sum + assignment.assignedEmployeeIds.length, 0);
  const required = assignments.reduce((sum, assignment) => sum + assignment.requiredHeadcount, 0);
  const openShiftCount = openShifts.filter((item) => !item.dismissed).length;
  const delayedDispatch = dispatch.filter((item) => item.status === "delayed").length;
  const activeDispatch = dispatch.filter((item) => item.status !== "off_shift").length;

  return {
    laborUtilization: required > 0 ? Math.min(100, Math.round((totalScheduled / required) * 100)) : 0,
    crewUtilization: totalAssignments > 0 ? Math.min(100, Math.round((new Set(assignments.flatMap((item) => item.assignedCrewIds)).size / totalAssignments) * 100)) : 0,
    idleTimeHours: 0,
    overtimeRiskCount: conflicts.filter((item) => item.type === "overtime_threshold_risk" && item.resolutionStatus === "open").length,
    assignmentCompletionRate: totalAssignments > 0 ? Math.round((assignments.filter((item) => item.status === "completed").length / totalAssignments) * 100) : 0,
    openShiftFillRate: assignments.length > 0 ? Math.max(0, Math.round(((assignments.length - openShiftCount) / assignments.length) * 100)) : 100,
    scheduleConflictCount: conflicts.length,
    averageReassignmentCount: 0,
    understaffingCount: conflicts.filter((item) => item.type === "understaffed_project" && item.resolutionStatus === "open").length,
    overstaffingCount: conflicts.filter((item) => item.type === "overstaffed_project" && item.resolutionStatus === "open").length,
    scheduleHealth: 0,
    travelEfficiencyPlaceholder: 0,
    dispatchPunctuality: activeDispatch > 0 ? Math.max(0, Math.round(((activeDispatch - delayedDispatch) / activeDispatch) * 100)) : 100,
    missedStartTimesPlaceholder: 0,
    previousPeriodDelta: {
      laborUtilization: 0,
      crewUtilization: 0,
      openShiftFillRate: 0,
      scheduleConflictCount: 0,
    },
  };
}

function buildPayloadFromRows(rows: LoadedRows): SchedulingPayload {
  const projectsById = new Map(rows.projects.map((project) => [project.id, project]));
  const phasesById = new Map(rows.phases.map((phase) => [phase.id, phase]));
  const tasksById = new Map(rows.tasks.map((task) => [task.id, task]));
  const crewsById = new Map(rows.crews.map((crew) => [crew.id, crew]));
  const employeesById = new Map(rows.employees.map((employee) => [employee.id, employee]));
  const profilesById = profileNameMap(rows.profiles);

  const membershipsByCrew = new Map<string, WorkforceMembershipRow[]>();
  for (const membership of rows.memberships) {
    if (membership.status !== "active") {
      continue;
    }
    const existing = membershipsByCrew.get(membership.crew_id);
    if (existing) {
      existing.push(membership);
    } else {
      membershipsByCrew.set(membership.crew_id, [membership]);
    }
  }

  const assignments = rows.assignments.map((assignment) =>
    toScheduleAssignment(
      assignment,
      projectsById,
      phasesById,
      tasksById,
      crewsById,
      employeesById,
      profilesById,
      membershipsByCrew,
    ),
  );

  const events = toEventStateMaps(rows.events);
  const todayIso = new Date().toISOString().slice(0, 10);
  const timeOff = buildTimeOffFromEmployees(rows.employees, profilesById, todayIso);
  const availability = buildAvailability(assignments, rows.employees, rows.crews, profilesById);
  const contractorVendors = buildAvailableContractorsOrVendors(rows.vendors, rows.tradePartnerAssignments, todayIso);
  const openShifts = buildOpenShifts(assignments, availability, events);
  const baseConflicts = detectSchedulingConflicts({
    assignments,
    openShifts,
    availability,
    timeOff,
  });
  const conflicts = applyConflictResolutions(baseConflicts, events);
  const dispatch = buildDispatchResources(assignments, rows.crews, rows.employees, rows.equipment, profilesById, events);
  const insights = buildInsights(conflicts, openShifts, events);

  const health = buildScheduleHealth({ assignments, conflicts, openShifts, dispatch });
  const analytics = buildAnalytics(assignments, conflicts, openShifts, dispatch);
  analytics.scheduleHealth = health.score;

  const summary = summarize(assignments, conflicts, openShifts, availability);
  const scheduleHealthKpi = summary.kpis.find((kpi) => kpi.id === "scheduleHealth");
  if (scheduleHealthKpi) {
    scheduleHealthKpi.value = `${health.score}%`;
    scheduleHealthKpi.status = health.score >= 75 ? "good" : health.score >= 50 ? "watch" : "risk";
  }

  return {
    summary,
    assignments,
    dispatch,
    openShifts,
    conflicts,
    availability,
    contractorVendors,
    insights,
    timeOff,
    health: {
      ...health,
      isMock: false,
    },
    analytics,
    projectOptions: rows.projects.map((project) => ({ id: project.id, name: project.name })),
    crewOptions: rows.crews.map((crew) => ({ id: crew.id, name: crew.name })),
    employeeOptions: rows.employees.map((employee) => {
      const profileName = employee.profile_id ? profilesById.get(employee.profile_id) ?? "" : "";
      return {
        id: employee.id,
        name: profileName || employee.employee_number,
        trade: employee.trade ?? "",
      };
    }),
    tradeOptions: buildTradeOptions(rows.employees),
  };
}

async function loadLivePayload() {
  const supabase = createClient();
  const workspace = await resolveWorkspaceContext(supabase);

  if (!workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve workspace for scheduling.");
  }

  if (!supabase) {
    throw new Error("Unable to connect to Supabase for scheduling.");
  }

  const repository = createWorkforceRepository(supabase);
  const companyId = workspace.context.companyId;

  const [
    assignments,
    projects,
    phases,
    tasks,
    crews,
    memberships,
    employees,
    profiles,
    equipment,
    vendorsResponse,
    tradePartnerAssignmentsResponse,
    eventsResponse,
  ] = await Promise.all([
    repository.listWorkforceAssignments(companyId),
    repository.listProjects(companyId),
    repository.listPhases(companyId),
    repository.listTasks(companyId),
    repository.listCrews(companyId),
    repository.listCrewMemberships(companyId),
    repository.listEmployees(companyId),
    repository.listProfiles(companyId),
    repository.listEquipment(companyId),
    supabase
      .from("vendors")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "active")
      .limit(200),
    supabase
      .from("trade_partner_assignments")
      .select("*")
      .eq("company_id", companyId)
      .eq("assignment_status", "active")
      .limit(500),
    supabase
      .from("workforce_events")
      .select("id, event_type, entity_type, entity_id, payload, occurred_at")
      .eq("company_id", companyId)
      .in("event_type", [
        "workforce.dispatch.status.updated",
        "workforce.scheduling.open_shift.updated",
        "workforce.scheduling.conflict.resolution.updated",
        "workforce.scheduling.insight.status.updated",
      ])
      .order("occurred_at", { ascending: false })
      .limit(500),
  ]);

  const loadError = vendorsResponse.error || tradePartnerAssignmentsResponse.error || eventsResponse.error;
  if (loadError) {
    throw loadError;
  }

  return {
    payload: buildPayloadFromRows({
      assignments,
      projects,
      phases,
      tasks,
      crews,
      memberships,
      employees,
      profiles,
      equipment,
      vendors: (vendorsResponse.data ?? []) as VendorRow[],
      tradePartnerAssignments: (tradePartnerAssignmentsResponse.data ?? []) as TradePartnerAssignmentRow[],
      events: (eventsResponse.data ?? []) as SchedulingEventRow[],
    }),
    companyId,
    userId: workspace.context.userId,
    supabase,
  };
}

function assignmentUpdateFromChanges(
  base: WorkforceAssignmentRow,
  changes: Partial<Pick<ScheduleAssignment, "date" | "shift" | "assignedCrewIds" | "assignedEmployeeIds" | "startTime" | "endTime">>,
): Partial<WorkforceAssignmentRow> {
  const nextStartsAt = changes.date || changes.startTime
    ? combineDateAndTime(changes.date ?? toIsoDate(base.starts_at), changes.startTime ?? toTime(base.starts_at))
    : base.starts_at;

  const nextEndsAt = changes.date || changes.endTime
    ? combineDateAndTime(changes.date ?? toIsoDate(base.ends_at), changes.endTime ?? toTime(base.ends_at))
    : base.ends_at;

  const requestedCrewId = changes.assignedCrewIds ? (changes.assignedCrewIds[0] ?? null) : base.crew_id;
  const requestedEmployeeId = changes.assignedEmployeeIds ? (changes.assignedEmployeeIds[0] ?? null) : base.employee_id;

  const useEmployee = Boolean(requestedEmployeeId);

  return {
    starts_at: nextStartsAt,
    ends_at: nextEndsAt,
    crew_id: useEmployee ? null : requestedCrewId,
    employee_id: useEmployee ? requestedEmployeeId : null,
    assignment_type: useEmployee ? "employee" : "crew",
    planned_hours: durationHours(nextStartsAt, nextEndsAt),
  };
}

function parseDispatchId(dispatchId: string): { resourceType: "crew" | "employee" | "equipment"; resourceId: string } | null {
  const [resourceType, resourceId] = dispatchId.split(":");
  if (!resourceId) {
    return null;
  }

  if (resourceType === "crew" || resourceType === "employee" || resourceType === "equipment") {
    return { resourceType, resourceId };
  }

  return null;
}

async function validateNoOverlap(params: {
  supabase: SchedulingSupabaseClient;
  companyId: string;
  startsAt: string;
  endsAt: string;
  employeeId: string | null;
  crewId: string | null;
  excludeAssignmentId?: string;
}) {
  if (!params.employeeId && !params.crewId) {
    return;
  }

  let query = params.supabase
    .from("workforce_assignments")
    .select("id, starts_at, ends_at, status")
    .eq("company_id", params.companyId)
    .in("status", ["planned", "confirmed", "in_progress"]);

  if (params.employeeId) {
    query = query.eq("employee_id", params.employeeId);
  }

  if (params.crewId) {
    query = query.eq("crew_id", params.crewId);
  }

  if (params.excludeAssignmentId) {
    query = query.neq("id", params.excludeAssignmentId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const conflicting = (data ?? []).find((row) => overlaps(params.startsAt, params.endsAt, row.starts_at, row.ends_at));
  if (conflicting) {
    throw new Error("Assignment conflicts with an existing schedule for this resource.");
  }
}

async function updateAssignmentStatusFromDispatch(params: {
  supabase: SchedulingSupabaseClient;
  companyId: string;
  userId: string;
  assignmentId: string | null;
  dispatchStatus: DispatchStatus;
}) {
  if (!params.assignmentId) {
    return;
  }

  const nextStatus = mapDispatchStatusToAssignmentStatus(params.dispatchStatus);
  if (!nextStatus) {
    return;
  }

  const { error } = await params.supabase
    .from("workforce_assignments")
    .update({
      status: nextStatus,
      updated_by: params.userId,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.assignmentId);

  if (error) {
    throw error;
  }
}

export function createSupabaseSchedulingService(): SchedulingService {
  return {
    async getScheduling() {
      const { payload } = await loadLivePayload();
      return payload;
    },

    async createAssignment(draft) {
      const { companyId, userId, supabase } = await loadLivePayload();
      const orion = createSupabaseOrionEventPublisher(supabase);

      const startsAt = combineDateAndTime(draft.date, draft.startTime);
      const endsAt = combineDateAndTime(draft.date, draft.endTime);
      const useEmployee = draft.assignedEmployeeIds.length > 0;
      const employeeId = useEmployee ? draft.assignedEmployeeIds[0] ?? null : null;
      const crewId = useEmployee ? null : draft.assignedCrewIds[0] ?? null;
      const assignmentType: WorkforceAssignmentRow["assignment_type"] = useEmployee ? "employee" : "crew";

      await validateNoOverlap({
        supabase,
        companyId,
        startsAt,
        endsAt,
        employeeId,
        crewId,
      });

      const { data: inserted, error } = await supabase
        .from("workforce_assignments")
        .insert({
          company_id: companyId,
          assignment_type: assignmentType,
          crew_id: crewId,
          employee_id: employeeId,
          project_id: draft.projectId,
          phase_id: null,
          task_id: null,
          title: draft.title,
          description: draft.notes || null,
          starts_at: startsAt,
          ends_at: endsAt,
          planned_hours: durationHours(startsAt, endsAt),
          status: mapDraftStatus(draft.status),
          source_type: "manual",
          source_id: null,
          notes: draft.notes || null,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      if (inserted?.id) {
        await orion.publishEvent({
          company_id: companyId,
          actor_profile_id: userId,
          event_type: "schedule.created",
          aggregate_type: "schedule",
          aggregate_id: inserted.id,
          source_module: "scheduling",
          payload: {
            schedule_id: inserted.id,
            project_id: draft.projectId,
            title: draft.title,
            starts_at: startsAt,
            ends_at: endsAt,
            assignment_type: assignmentType,
            crew_id: crewId,
            employee_id: employeeId,
            deep_link: "/scheduling",
          },
          metadata: {
            event_category: "scheduling",
            event_severity: "info",
            deep_link: "/scheduling",
          },
        });
      }

      const { payload } = await loadLivePayload();
      return payload;
    },

    async moveDispatchResource(dispatchId, status, delayReason) {
      const { companyId, userId, supabase } = await loadLivePayload();

      const parsed = parseDispatchId(dispatchId);
      if (!parsed) {
        throw new Error("Invalid dispatch resource id.");
      }

      const current = (await loadLivePayload()).payload.dispatch.find((item) => item.id === dispatchId) ?? null;

      const { error } = await supabase
        .from("workforce_events")
        .insert({
          company_id: companyId,
          event_type: "workforce.dispatch.status.updated",
          entity_type: parsed.resourceType,
          entity_id: parsed.resourceId,
          action: "update",
          actor_profile_id: userId,
          payload: {
            dispatch_id: dispatchId,
            resource_type: parsed.resourceType,
            resource_id: parsed.resourceId,
            dispatch_status: status,
            delay_reason: delayReason,
            current_assignment_id: current?.currentAssignmentId ?? null,
          },
        });

      if (error) {
        throw error;
      }

      await updateAssignmentStatusFromDispatch({
        supabase,
        companyId,
        userId,
        assignmentId: current?.currentAssignmentId ?? null,
        dispatchStatus: status,
      });

      const { payload } = await loadLivePayload();
      return payload;
    },

    async assignOpenShift(openShiftId, employeeId, crewId) {
      const { companyId, userId, supabase } = await loadLivePayload();
      const assignmentId = openShiftId.startsWith("open-") ? openShiftId.slice(5) : openShiftId;

      const { data: current, error: fetchError } = await supabase
        .from("workforce_assignments")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", assignmentId)
        .maybeSingle<WorkforceAssignmentRow>();

      if (fetchError) {
        throw fetchError;
      }

      if (!current) {
        throw new Error("Open shift assignment not found.");
      }

      const nextEmployeeId = employeeId ?? null;
      const nextCrewId = employeeId ? null : (crewId ?? current.crew_id);
      const startsAt = current.starts_at;
      const endsAt = current.ends_at;

      await validateNoOverlap({
        supabase,
        companyId,
        startsAt,
        endsAt,
        employeeId: nextEmployeeId,
        crewId: nextCrewId,
        excludeAssignmentId: assignmentId,
      });

      const { error } = await supabase
        .from("workforce_assignments")
        .update({
          assignment_type: nextEmployeeId ? "employee" : "crew",
          employee_id: nextEmployeeId,
          crew_id: nextEmployeeId ? null : nextCrewId,
          status: "confirmed",
          updated_by: userId,
        })
        .eq("company_id", companyId)
        .eq("id", assignmentId);

      if (error) {
        throw error;
      }

      const { error: eventError } = await supabase
        .from("workforce_events")
        .insert({
          company_id: companyId,
          event_type: "workforce.scheduling.open_shift.updated",
          entity_type: "assignment",
          entity_id: assignmentId,
          action: "update",
          actor_profile_id: userId,
          payload: {
            open_shift_id: openShiftId,
            assignment_id: assignmentId,
            assigned_employee_id: nextEmployeeId,
            assigned_crew_id: nextCrewId,
            dismissed: false,
          },
        });

      if (eventError) {
        throw eventError;
      }

      const { payload } = await loadLivePayload();
      return payload;
    },

    async resolveConflict(conflictId, status) {
      const { companyId, userId, supabase } = await loadLivePayload();
      const assignmentEntityId = conflictId.split("-").reverse().find((token) => token.length > 20) ?? companyId;

      const { error } = await supabase
        .from("workforce_events")
        .insert({
          company_id: companyId,
          event_type: "workforce.scheduling.conflict.resolution.updated",
          entity_type: "assignment",
          entity_id: assignmentEntityId,
          action: "update",
          actor_profile_id: userId,
          payload: {
            conflict_id: conflictId,
            resolution_status: status,
          },
        });

      if (error) {
        throw error;
      }

      const { payload } = await loadLivePayload();
      return payload;
    },

    async acceptInsight(insightId) {
      const { companyId, userId, supabase } = await loadLivePayload();

      const { error } = await supabase
        .from("workforce_events")
        .insert({
          company_id: companyId,
          event_type: "workforce.scheduling.insight.status.updated",
          entity_type: "company",
          entity_id: companyId,
          action: "update",
          actor_profile_id: userId,
          payload: {
            insight_id: insightId,
            insight_status: "accepted",
          },
        });

      if (error) {
        throw error;
      }

      const { payload } = await loadLivePayload();
      return payload;
    },

    async dismissInsight(insightId) {
      const { companyId, userId, supabase } = await loadLivePayload();

      const { error } = await supabase
        .from("workforce_events")
        .insert({
          company_id: companyId,
          event_type: "workforce.scheduling.insight.status.updated",
          entity_type: "company",
          entity_id: companyId,
          action: "update",
          actor_profile_id: userId,
          payload: {
            insight_id: insightId,
            insight_status: "dismissed",
          },
        });

      if (error) {
        throw error;
      }

      const { payload } = await loadLivePayload();
      return payload;
    },

    async moveAssignment(assignmentId, changes) {
      const { companyId, userId, supabase } = await loadLivePayload();
      const orion = createSupabaseOrionEventPublisher(supabase);

      const { data: current, error: fetchError } = await supabase
        .from("workforce_assignments")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", assignmentId)
        .maybeSingle<WorkforceAssignmentRow>();

      if (fetchError) {
        throw fetchError;
      }

      if (!current) {
        throw new Error("Scheduling assignment not found.");
      }

      const patch = assignmentUpdateFromChanges(current, changes);

      await validateNoOverlap({
        supabase,
        companyId,
        startsAt: patch.starts_at ?? current.starts_at,
        endsAt: patch.ends_at ?? current.ends_at,
        employeeId: patch.employee_id ?? current.employee_id,
        crewId: patch.crew_id ?? current.crew_id,
        excludeAssignmentId: assignmentId,
      });

      const { error } = await supabase
        .from("workforce_assignments")
        .update({
          ...patch,
          updated_by: userId,
        })
        .eq("company_id", companyId)
        .eq("id", assignmentId);

      if (error) {
        throw error;
      }

      await orion.publishEvent({
        company_id: companyId,
        actor_profile_id: userId,
        event_type: "schedule.updated",
        aggregate_type: "schedule",
        aggregate_id: assignmentId,
        source_module: "scheduling",
        payload: {
          schedule_id: assignmentId,
          project_id: current.project_id,
          starts_at: patch.starts_at,
          ends_at: patch.ends_at,
          crew_id: patch.crew_id,
          employee_id: patch.employee_id,
          deep_link: "/scheduling",
        },
        metadata: {
          event_category: "scheduling",
          event_severity: "info",
          deep_link: "/scheduling",
        },
      });

      const { payload } = await loadLivePayload();
      return payload;
    },
  };
}

import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createWorkforceRepository } from "@/lib/workforce/workforce-repository";
import { buildScheduleHealth, detectSchedulingConflicts } from "./conflict-engine";
import type { SchedulingService } from "./service";
import type {
  AssignmentDraft,
  AssignmentStatus,
  OpenShift,
  ResourceAvailability,
  ScheduleAssignment,
  ScheduleConflict,
  SchedulingPayload,
  TimeOffEntry,
} from "./types";
import type {
  WorkforceAssignmentRow,
  WorkforceCrewRow,
  WorkforceEmployeeRow,
  WorkforceMembershipRow,
  WorkforcePhaseRow,
  WorkforceProfileRow,
  WorkforceProjectRow,
  WorkforceTaskRow,
} from "@/lib/workforce/workforce-types";

const UNSUPPORTED_DISPATCH_ERROR = "Persistent dispatch state is not implemented in the current production schema.";
const UNSUPPORTED_OPEN_SHIFT_ERROR = "Persistent open shift state is not implemented in the current production schema.";
const UNSUPPORTED_CONFLICT_RESOLUTION_ERROR = "Persistent conflict resolution state is not implemented in the current production schema.";
const UNSUPPORTED_INSIGHT_ERROR = "Persistent insight status is not implemented in the current production schema.";

function toIsoDate(iso: string) {
  return iso.slice(0, 10);
}

function toTime(iso: string) {
  return iso.slice(11, 16);
}

function mapAssignmentType(sourceType: WorkforceAssignmentRow["source_type"], assignmentType: WorkforceAssignmentRow["assignment_type"]): ScheduleAssignment["type"] {
  if (sourceType === "task") {
    return "project_work";
  }

  if (sourceType === "schedule") {
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

  if (status === "completed") {
    return "low";
  }

  if (status === "cancelled") {
    return "low";
  }

  return "medium";
}

function profileNameMap(profiles: WorkforceProfileRow[]) {
  return new Map(
    profiles.map((profile) => {
      const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
      return [profile.id, fullName];
    }),
  );
}

function assignmentsToConflicts(assignments: ScheduleAssignment[]): { conflicts: ScheduleConflict[]; availability: ResourceAvailability[]; timeOff: TimeOffEntry[]; openShifts: OpenShift[] } {
  const openShifts: OpenShift[] = [];
  const availability: ResourceAvailability[] = [];
  const timeOff: TimeOffEntry[] = [];

  const conflicts = detectSchedulingConflicts({
    assignments,
    openShifts,
    availability,
    timeOff,
  });

  return {
    conflicts,
    availability,
    timeOff,
    openShifts,
  };
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

function buildAnalytics(assignments: ScheduleAssignment[], conflicts: ScheduleConflict[], openShifts: OpenShift[]): SchedulingPayload["analytics"] {
  const totalAssignments = assignments.length;
  const totalScheduled = assignments.reduce((sum, assignment) => sum + assignment.assignedEmployeeIds.length, 0);
  const required = assignments.reduce((sum, assignment) => sum + assignment.requiredHeadcount, 0);
  const openShiftCount = openShifts.filter((item) => !item.dismissed).length;

  return {
    laborUtilization: required > 0 ? Math.min(100, Math.round((totalScheduled / required) * 100)) : 0,
    crewUtilization: totalAssignments > 0 ? Math.min(100, Math.round((new Set(assignments.flatMap((item) => item.assignedCrewIds)).size / totalAssignments) * 100)) : 0,
    idleTimeHours: 0,
    overtimeRiskCount: conflicts.filter((item) => item.type === "overtime_threshold_risk" && item.resolutionStatus === "open").length,
    assignmentCompletionRate: totalAssignments > 0 ? Math.round((assignments.filter((item) => item.status === "completed").length / totalAssignments) * 100) : 0,
    openShiftFillRate: openShiftCount > 0 ? 0 : 0,
    scheduleConflictCount: conflicts.length,
    averageReassignmentCount: 0,
    understaffingCount: conflicts.filter((item) => item.type === "understaffed_project" && item.resolutionStatus === "open").length,
    overstaffingCount: conflicts.filter((item) => item.type === "overstaffed_project" && item.resolutionStatus === "open").length,
    scheduleHealth: 0,
    travelEfficiencyPlaceholder: 0,
    dispatchPunctuality: 0,
    missedStartTimesPlaceholder: 0,
    previousPeriodDelta: {
      laborUtilization: 0,
      crewUtilization: 0,
      openShiftFillRate: 0,
      scheduleConflictCount: 0,
    },
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

  const employeeIds = row.employee_id
    ? [row.employee_id]
    : membershipEmployeeIds;

  const requiredTrade = employee?.trade ?? "";
  const location = phase?.name ?? task?.title ?? "";
  const supervisorName = crew?.supervisor_profile_id
    ? profileNames.get(crew.supervisor_profile_id) ?? ""
    : "";

  const startDate = toIsoDate(row.starts_at);

  return {
    id: row.id,
    title: row.title,
    type: mapAssignmentType(row.source_type, row.assignment_type),
    status: mapAssignmentStatus(row.status),
    shift: mapShift(row.starts_at),
    priority: mapPriority(row.status),
    date: startDate,
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

function buildPayloadFromRows(rows: {
  assignments: WorkforceAssignmentRow[];
  projects: WorkforceProjectRow[];
  phases: WorkforcePhaseRow[];
  tasks: WorkforceTaskRow[];
  crews: WorkforceCrewRow[];
  employees: WorkforceEmployeeRow[];
  memberships: WorkforceMembershipRow[];
  profiles: WorkforceProfileRow[];
  timeOff: TimeOffEntry[];
}): SchedulingPayload {
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

  const { conflicts, availability, openShifts } = assignmentsToConflicts(assignments);
  const health = buildScheduleHealth({ assignments, conflicts, openShifts, dispatch: [] });
  const analytics = buildAnalytics(assignments, conflicts, openShifts);
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
    dispatch: [],
    openShifts,
    conflicts,
    availability,
    insights: [],
    timeOff: rows.timeOff,
    health: {
      ...health,
      isMock: false,
    },
    analytics,
    projectOptions: rows.projects.map((project) => ({ id: project.id, name: project.name })),
    crewOptions: rows.crews.map((crew) => ({ id: crew.id, name: crew.name })),
    employeeOptions: rows.employees.map((employee) => {
      const profileName = employee.profile_id ? profilesById.get(employee.profile_id) ?? "" : "";
      const fallbackName = employee.employee_number;
      return {
        id: employee.id,
        name: profileName || fallbackName,
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
  ]);

  void equipment;

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
      timeOff: [],
    }),
    companyId,
    userId: workspace.context.userId,
    supabase,
  };
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

  const requestedCrewId = changes.assignedCrewIds
    ? (changes.assignedCrewIds[0] ?? null)
    : base.crew_id;

  const requestedEmployeeId = changes.assignedEmployeeIds
    ? (changes.assignedEmployeeIds[0] ?? null)
    : base.employee_id;

  const useEmployee = Boolean(requestedEmployeeId);
  const nextEmployeeId = useEmployee ? requestedEmployeeId : null;
  const nextCrewId = useEmployee ? null : requestedCrewId;
  const nextAssignmentType: WorkforceAssignmentRow["assignment_type"] = useEmployee ? "employee" : "crew";

  return {
    starts_at: nextStartsAt,
    ends_at: nextEndsAt,
    crew_id: nextCrewId,
    employee_id: nextEmployeeId,
    assignment_type: nextAssignmentType,
  };
}

export function createSupabaseSchedulingService(): SchedulingService {
  return {
    async getScheduling() {
      const { payload } = await loadLivePayload();
      return payload;
    },

    async createAssignment(draft) {
      const { companyId, userId, supabase } = await loadLivePayload();

      const startsAt = combineDateAndTime(draft.date, draft.startTime);
      const endsAt = combineDateAndTime(draft.date, draft.endTime);
      const useEmployee = draft.assignedEmployeeIds.length > 0;
      const employeeId = useEmployee ? draft.assignedEmployeeIds[0] ?? null : null;
      const crewId = useEmployee ? null : draft.assignedCrewIds[0] ?? null;
      const assignmentType: WorkforceAssignmentRow["assignment_type"] = useEmployee ? "employee" : "crew";

      const { error } = await supabase
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
        });

      if (error) {
        throw error;
      }

      const { payload } = await loadLivePayload();
      return payload;
    },

    async moveDispatchResource() {
      throw new Error(UNSUPPORTED_DISPATCH_ERROR);
    },

    async assignOpenShift() {
      throw new Error(UNSUPPORTED_OPEN_SHIFT_ERROR);
    },

    async resolveConflict() {
      throw new Error(UNSUPPORTED_CONFLICT_RESOLUTION_ERROR);
    },

    async acceptInsight() {
      throw new Error(UNSUPPORTED_INSIGHT_ERROR);
    },

    async dismissInsight() {
      throw new Error(UNSUPPORTED_INSIGHT_ERROR);
    },

    async moveAssignment(assignmentId, changes) {
      const { companyId, userId, supabase } = await loadLivePayload();

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

      const { payload } = await loadLivePayload();
      return payload;
    },
  };
}

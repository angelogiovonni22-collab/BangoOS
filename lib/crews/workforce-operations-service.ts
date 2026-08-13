import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createSchedulingService, type SchedulingPayload } from "@/lib/scheduling";
import { createWorkforceIntelligenceService, createWorkforceService } from "@/lib/workforce";
import type { WorkforceAssignmentView, WorkforceService } from "@/lib/workforce";
import type {
  AssignEmployeeToCrewInput,
  AssignEquipmentInput,
  AssignmentConflictRow,
  AssignSupervisorInput,
  CommandCenterWidgets,
  CrewStatusRow,
  CrewTaskBoardRow,
  DailyAssignmentRow,
  DailyOperationRow,
  EmployeeStatusRow,
  MoveEmployeeProjectInput,
  OverdueItems,
  ProjectOperationsRow,
  ProjectStaffingRow,
  RemoveEmployeeFromCrewInput,
  SetCrewShiftStatusInput,
  WorkforceCrewOperationalStatus,
  WorkforceEquipmentDispatchInterface,
  WorkforceGpsSyncInterface,
  WorkforceLaborCostInterface,
  WorkforceMobileSyncInterface,
  OrionRecommendationOutcomeStatus,
  WorkforceOperationsDashboardData,
  WorkforceOperationsIntegrations,
  WorkforceShiftStateProvider,
  WorkforceShiftStatus,
  WorkforceTimeClockInterface,
} from "./workforce-operations-types";
import { evaluateOrionWorkforceIntelligence } from "./workforce-orion-intelligence";
import { createWorkforceIntelligencePersistenceService } from "./workforce-intelligence-persistence";

export type WorkforceOperationsService = {
  getDashboard: () => Promise<WorkforceOperationsDashboardData>;
  assignEmployeeToCrew: (input: AssignEmployeeToCrewInput) => Promise<void>;
  removeEmployeeFromCrew: (input: RemoveEmployeeFromCrewInput) => Promise<void>;
  reassignEmployeeToCrew: (input: AssignEmployeeToCrewInput) => Promise<void>;
  moveEmployeeBetweenProjects: (input: MoveEmployeeProjectInput) => Promise<void>;
  assignSupervisorToCrew: (input: AssignSupervisorInput) => Promise<void>;
  assignEquipmentToCrew: (input: AssignEquipmentInput) => Promise<void>;
  setCrewShiftStatus: (input: SetCrewShiftStatusInput) => Promise<void>;
  acknowledgeRecommendation: (input: { recommendationId: string; note?: string }) => Promise<void>;
  acceptRecommendation: (input: { recommendationId: string; note?: string }) => Promise<void>;
  dismissRecommendation: (input: { recommendationId: string; note?: string }) => Promise<void>;
  completeRecommendation: (input: { recommendationId: string; note?: string }) => Promise<void>;
  recordRecommendationOutcome: (input: { recommendationId: string; outcomeStatus: OrionRecommendationOutcomeStatus; note?: string }) => Promise<void>;
};

type WorkforceOperationsDeps = {
  gpsSync?: WorkforceGpsSyncInterface;
  timeClock?: WorkforceTimeClockInterface;
  mobileSync?: WorkforceMobileSyncInterface;
  laborCost?: WorkforceLaborCostInterface;
  equipmentDispatch?: WorkforceEquipmentDispatchInterface;
  shiftState?: WorkforceShiftStateProvider;
};

type TimeClockRow = {
  employeeId: string;
  lastCheckIn: string | null;
  hoursToday: number | null;
};

const noopGpsSync: WorkforceGpsSyncInterface = {
  async getCrewTravelState() {
    return [];
  },
};

const noopTimeClock: WorkforceTimeClockInterface = {
  async getDailyCheckIns() {
    return [];
  },
};

const noopMobileSync: WorkforceMobileSyncInterface = {
  async getConnectivitySnapshot() {
    return { onlineEmployeeIds: [] };
  },
};

const noopLaborCost: WorkforceLaborCostInterface = {
  async getLaborCostToday() {
    return {
      totalCost: null,
      source: "unavailable",
    };
  },
};

const noopEquipmentDispatch: WorkforceEquipmentDispatchInterface = {
  async assignCrewEquipment() {
    return { success: false };
  },
};

function createInMemoryShiftStateProvider(): WorkforceShiftStateProvider {
  const statuses = new Map<string, WorkforceShiftStatus>();

  return {
    async getCrewStatuses() {
      return Object.fromEntries(statuses.entries());
    },
    async setCrewStatus(_context, input) {
      statuses.set(input.crewId, input.status);
    },
  };
}

function toTodayIso(asOf: Date) {
  return asOf.toISOString().slice(0, 10);
}

function toShiftProgressPercent(startIso: string, endIso: string, asOf: Date) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const now = asOf.getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }

  if (now <= start) {
    return 0;
  }

  if (now >= end) {
    return 100;
  }

  return Math.round(((now - start) / (end - start)) * 100);
}

function toCrewOperationalStatus(shiftStatus: WorkforceShiftStatus): WorkforceCrewOperationalStatus {
  if (shiftStatus === "shift_started") {
    return "shift_started";
  }

  if (shiftStatus === "traveling") {
    return "traveling";
  }

  if (shiftStatus === "working") {
    return "working";
  }

  if (shiftStatus === "lunch") {
    return "lunch";
  }

  if (shiftStatus === "break") {
    return "break";
  }

  if (shiftStatus === "finished") {
    return "finished";
  }

  if (shiftStatus === "off_duty") {
    return "off_duty";
  }

  return "offline";
}

function deriveShiftStatus(params: {
  assignmentStatus: CrewStatusRow["assignmentStatus"];
  isActive: boolean;
  availability: "available" | "assigned";
  assignmentTitle: string | null;
}): WorkforceShiftStatus {
  if (!params.isActive) {
    return "off_duty";
  }

  if (params.assignmentStatus === "completed") {
    return "finished";
  }

  if (params.assignmentStatus === "in_progress") {
    const lower = (params.assignmentTitle || "").toLowerCase();
    if (lower.includes("lunch")) {
      return "lunch";
    }

    if (lower.includes("break")) {
      return "break";
    }

    return "working";
  }

  if (params.assignmentStatus === "planned") {
    return "shift_started";
  }

  if (params.assignmentStatus === "confirmed") {
    return "traveling";
  }

  if (params.availability === "assigned") {
    return "working";
  }

  return "off_duty";
}

function isLateEmployee(assignment: WorkforceAssignmentView | null, asOf: Date) {
  if (!assignment) {
    return false;
  }

  if (assignment.status !== "planned" && assignment.status !== "confirmed") {
    return false;
  }

  const start = new Date(assignment.startsAt).getTime();
  if (Number.isNaN(start)) {
    return false;
  }

  return start + 15 * 60 * 1000 < asOf.getTime();
}

function parseDailyNotes(notes: string | null) {
  if (!notes || !notes.trim()) {
    return {
      crewNotes: null,
      supervisorNotes: null,
      safetyNotes: null,
    };
  }

  return {
    crewNotes: notes,
    supervisorNotes: notes,
    safetyNotes: notes.toLowerCase().includes("safety") ? notes : null,
  };
}

async function loadDirectory(workforce: WorkforceService, companyId: string) {
  const [crewDirectory, employeeDirectory] = await Promise.all([
    workforce.getCrewDirectory(companyId, {
      query: "",
      status: "all",
      leadId: "all",
      supervisorId: "all",
      projectId: "all",
      assignmentStatus: "all",
      sortBy: "name_asc",
      page: 1,
      pageSize: 500,
    }),
    workforce.getEmployeeDirectory(companyId, {
      query: "",
      employmentStatus: "all",
      availabilityStatus: "all",
      crewId: "all",
      supervisorId: "all",
      projectId: "all",
      sortBy: "name_asc",
      page: 1,
      pageSize: 1000,
    }),
  ]);

  return { crewDirectory, employeeDirectory };
}

function buildProjectStaffingRows(input: {
  assignments: Array<{
    projectId: string;
    projectName: string;
    requiredHeadcount: number;
    assignedEmployeeIds: string[];
  }>;
}): ProjectStaffingRow[] {
  const byProject = new Map<string, ProjectStaffingRow>();

  for (const assignment of input.assignments) {
    const existing = byProject.get(assignment.projectId) || {
      projectId: assignment.projectId,
      projectName: assignment.projectName || "Unknown project",
      requiredWorkers: 0,
      assignedWorkers: 0,
      staffingHealth: "healthy" as const,
      openPositions: 0,
      laborBudget: null,
      atRisk: false,
    };

    existing.requiredWorkers += Math.max(assignment.requiredHeadcount, 0);
    existing.assignedWorkers += Math.max(assignment.assignedEmployeeIds.length, 0);
    existing.openPositions = Math.max(existing.requiredWorkers - existing.assignedWorkers, 0);

    existing.staffingHealth = existing.openPositions === 0
      ? "healthy"
      : existing.openPositions <= 2
        ? "watch"
        : "risk";

    existing.atRisk = existing.staffingHealth !== "healthy";
    byProject.set(assignment.projectId, existing);
  }

  return Array.from(byProject.values()).sort((left, right) => {
    if (left.atRisk !== right.atRisk) {
      return Number(right.atRisk) - Number(left.atRisk);
    }

    return left.projectName.localeCompare(right.projectName);
  });
}

function buildAssignmentConflicts(payload: SchedulingPayload | null): AssignmentConflictRow[] {
  if (!payload) {
    return [];
  }

  return payload.conflicts.map((conflict) => ({
    id: conflict.id,
    severity: conflict.severity,
    type: conflict.type,
    title: conflict.title,
    explanation: conflict.explanation,
    relatedProjectId: conflict.relatedProjectId,
    relatedCrewId: conflict.relatedCrewId,
    relatedEmployeeId: conflict.relatedEmployeeId,
    resolutionStatus: conflict.resolutionStatus,
  }));
}

function buildDailyAssignments(input: {
  assignmentsToday: SchedulingPayload["assignments"];
  employeeNamesById: Map<string, string>;
  crewNamesById: Map<string, string>;
}): DailyAssignmentRow[] {
  return input.assignmentsToday.map((assignment) => ({
    assignmentId: assignment.id,
    title: assignment.title,
    projectId: assignment.scope.projectId,
    projectName: assignment.scope.projectName,
    crewId: assignment.assignedCrewIds[0] || null,
    crewName: assignment.assignedCrewIds[0]
      ? input.crewNamesById.get(assignment.assignedCrewIds[0]) || null
      : null,
    assignedEmployeeIds: assignment.assignedEmployeeIds,
    assignedEmployeeNames: assignment.assignedEmployeeIds.map((employeeId) => input.employeeNamesById.get(employeeId) || employeeId),
    requiredHeadcount: assignment.requiredHeadcount,
    missingHeadcount: Math.max(assignment.requiredHeadcount - assignment.assignedEmployeeIds.length, 0),
    status: assignment.status,
    startTime: assignment.startTime,
    endTime: assignment.endTime,
  }));
}

function buildCrewTaskBoards(input: {
  crewStatus: CrewStatusRow[];
  assignments: SchedulingPayload["assignments"];
}): CrewTaskBoardRow[] {
  return input.crewStatus.map((crew) => {
    const relatedAssignments = input.assignments.filter((assignment) => assignment.assignedCrewIds.includes(crew.crewId));
    const todaysTasks = relatedAssignments
      .filter((assignment) => assignment.status === "in_progress" || assignment.status === "published")
      .slice(0, 6)
      .map((assignment) => ({ assignmentId: assignment.id, title: assignment.title, projectName: assignment.scope.projectName }));

    const upcomingTasks = relatedAssignments
      .filter((assignment) => assignment.status === "draft")
      .slice(0, 6)
      .map((assignment) => ({ assignmentId: assignment.id, title: assignment.title, projectName: assignment.scope.projectName }));

    const completedTasks = relatedAssignments
      .filter((assignment) => assignment.status === "completed")
      .slice(0, 6)
      .map((assignment) => ({ assignmentId: assignment.id, title: assignment.title, projectName: assignment.scope.projectName }));

    const safetyItems = relatedAssignments
      .filter((assignment) => Boolean(assignment.safetyRequirement))
      .map((assignment) => assignment.safetyRequirement)
      .slice(0, 4);

    const supervisorNotes = relatedAssignments
      .map((assignment) => assignment.notes)
      .filter((note) => Boolean(note.trim()))
      .slice(0, 4);

    return {
      crewId: crew.crewId,
      crewName: crew.crewName,
      tasks: {
        todaysTasks,
        upcomingTasks,
        completedTasks,
        safetyItems,
        supervisorNotes,
      },
    };
  });
}

function buildProjectOperationsRows(input: {
  projectStaffing: ProjectStaffingRow[];
  assignmentsToday: SchedulingPayload["assignments"];
  crewStatus: CrewStatusRow[];
}): ProjectOperationsRow[] {
  const crewByProject = new Map<string, Set<string>>();
  const equipmentByProject = new Map<string, number>();
  const laborByProject = new Map<string, { planned: number; completed: number }>();

  for (const assignment of input.assignmentsToday) {
    const crewSet = crewByProject.get(assignment.scope.projectId) || new Set<string>();
    for (const crewId of assignment.assignedCrewIds) {
      crewSet.add(crewId);
    }
    crewByProject.set(assignment.scope.projectId, crewSet);

    const planned = laborByProject.get(assignment.scope.projectId) || { planned: 0, completed: 0 };
    planned.planned += assignment.requiredHeadcount;
    planned.completed += assignment.assignedEmployeeIds.length;
    laborByProject.set(assignment.scope.projectId, planned);
  }

  for (const crew of input.crewStatus) {
    if (!crew.currentProjectName) {
      continue;
    }

    const matchingProject = input.projectStaffing.find((project) => project.projectName === crew.currentProjectName);
    if (!matchingProject) {
      continue;
    }

    const next = equipmentByProject.get(matchingProject.projectId) || 0;
    equipmentByProject.set(matchingProject.projectId, next + crew.equipmentAssignedCount);
  }

  return input.projectStaffing.map((project) => {
    const crewAssigned = crewByProject.get(project.projectId)?.size || 0;
    const labor = laborByProject.get(project.projectId) || { planned: 0, completed: 0 };
    const laborProgress = labor.planned > 0
      ? Math.round((labor.completed / labor.planned) * 100)
      : 0;

    const scheduleStatus = project.staffingHealth === "healthy"
      ? "on_track" as const
      : project.staffingHealth === "watch"
        ? "watch" as const
        : "at_risk" as const;

    return {
      projectId: project.projectId,
      projectName: project.projectName,
      crewAssigned,
      requiredWorkers: project.requiredWorkers,
      missingWorkers: project.openPositions,
      equipmentAssigned: equipmentByProject.get(project.projectId) || 0,
      scheduleStatus,
      laborProgress,
    };
  });
}

function buildOverdueItems(input: {
  employeeStatus: EmployeeStatusRow[];
  dailyAssignments: DailyAssignmentRow[];
  dailyOperations: DailyOperationRow[];
  crewStatus: CrewStatusRow[];
}): OverdueItems {
  return {
    lateEmployees: input.employeeStatus
      .filter((employee) => employee.currentStatus === "late")
      .map((employee) => ({ employeeId: employee.employeeId, employeeName: employee.employeeName })),
    missingCheckIns: input.employeeStatus
      .filter((employee) => employee.currentStatus === "working" && !employee.lastCheckIn)
      .map((employee) => ({ employeeId: employee.employeeId, employeeName: employee.employeeName })),
    missingAssignments: input.employeeStatus
      .filter((employee) => employee.currentStatus === "available" && !employee.assignedJobName)
      .map((employee) => ({ employeeId: employee.employeeId, employeeName: employee.employeeName })),
    safetyFlags: input.dailyOperations
      .filter((row) => Boolean(row.safetyNotes))
      .map((row) => ({ assignmentId: row.assignmentId, assignmentTitle: row.assignmentTitle })),
    missingEquipment: input.crewStatus
      .filter((crew) => (crew.shiftStatus === "working" || crew.shiftStatus === "traveling") && crew.equipmentAssignedCount === 0)
      .map((crew) => ({ crewId: crew.crewId, crewName: crew.crewName })),
  };
}

function buildCommandCenter(input: {
  summary: WorkforceOperationsDashboardData["summary"];
  crewStatus: CrewStatusRow[];
  projectStaffing: ProjectStaffingRow[];
  employeeStatus: EmployeeStatusRow[];
  overdueItems: OverdueItems;
}): CommandCenterWidgets {
  const crewsRequiringAttention = input.crewStatus
    .filter((crew) => crew.shiftStatus === "off_duty" || crew.assignmentStatus === "planned")
    .slice(0, 8)
    .map((crew) => ({
      crewId: crew.crewId,
      crewName: crew.crewName,
      reason: crew.shiftStatus === "off_duty" ? "Crew is off duty" : "Crew assignment not started",
    }));

  const projectsAtRisk = input.projectStaffing
    .filter((project) => project.atRisk)
    .slice(0, 8)
    .map((project) => ({
      projectId: project.projectId,
      projectName: project.projectName,
      reason: `${project.openPositions} workers missing`,
    }));

  const employeesRequiringAction = input.employeeStatus
    .filter((employee) => employee.currentStatus === "late" || employee.currentStatus === "absent" || employee.overtime)
    .slice(0, 10)
    .map((employee) => ({
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      reason: employee.currentStatus === "late"
        ? "Late"
        : employee.currentStatus === "absent"
          ? "Absent"
          : "Overtime threshold",
    }));

  const openStaffingIssues = input.projectStaffing
    .filter((project) => project.openPositions > 0)
    .slice(0, 10)
    .map((project) => ({ projectName: project.projectName, missingWorkers: project.openPositions }));

  return {
    todaysWorkforce: {
      activeEmployees: input.summary.activeEmployees,
      activeCrews: input.summary.activeCrews,
      openStaffingIssues: openStaffingIssues.length,
    },
    crewsRequiringAttention,
    projectsAtRisk,
    employeesRequiringAction,
    openStaffingIssues,
    todaysRisks: [],
    todaysOpportunities: [],
    criticalWorkforceAlerts: [],
    recommendedSupervisorActions: [],
    upcomingStaffingIssues: [],
    forecastedLaborShortages: [],
  };
}

async function resolveRuntime() {
  const supabase = createClient();
  if (!supabase) {
    throw new Error("Unable to connect to Supabase for CrewOS workforce operations.");
  }

  const workspace = await resolveWorkspaceContext(supabase);

  if (!workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve CrewOS workspace context.");
  }

  const workforce = createWorkforceService(supabase);
  return {
    supabase,
    workspace: workspace.context,
    workforce,
  };
}

export function createWorkforceOperationsService(deps: WorkforceOperationsDeps = {}): WorkforceOperationsService {
  const gpsSync = deps.gpsSync || noopGpsSync;
  const timeClock = deps.timeClock || noopTimeClock;
  const mobileSync = deps.mobileSync || noopMobileSync;
  const laborCost = deps.laborCost || noopLaborCost;
  const equipmentDispatch = deps.equipmentDispatch || noopEquipmentDispatch;
  const shiftState = deps.shiftState || createInMemoryShiftStateProvider();

  return {
    async getDashboard() {
      const { supabase, workspace, workforce } = await resolveRuntime();

      const companyId = workspace.companyId;
      const asOf = new Date();
      const schedulingService = createSchedulingService();
      const intelligence = createWorkforceIntelligenceService(supabase);
      const persistence = createWorkforceIntelligencePersistenceService(supabase);

      const [{ crewDirectory, employeeDirectory }, schedulingPayload, findings, clockRows, travelRows, cost, mobile, shiftStatuses] = await Promise.all([
        loadDirectory(workforce, companyId),
        schedulingService.getScheduling().catch(() => null),
        intelligence.evaluateCompany(companyId).catch(() => null),
        timeClock.getDailyCheckIns({ companyId, asOf }).catch(() => [] as TimeClockRow[]),
        gpsSync.getCrewTravelState({ companyId, asOf }).catch(() => []),
        laborCost.getLaborCostToday({ companyId, asOf }).catch(async () => noopLaborCost.getLaborCostToday({ companyId, asOf })),
        mobileSync.getConnectivitySnapshot({ companyId, asOf }).catch(async () => noopMobileSync.getConnectivitySnapshot({ companyId, asOf })),
        shiftState.getCrewStatuses({ companyId, asOf }).catch(() => ({} as Record<string, WorkforceShiftStatus>)),
      ]);

      const assignmentsToday = (schedulingPayload?.assignments || []).filter((assignment) => assignment.date === toTodayIso(asOf));
      const assignmentByCrewId = new Map<string, (typeof assignmentsToday)[number]>();
      const assignmentByEmployeeId = new Map<string, (typeof assignmentsToday)[number]>();

      for (const assignment of assignmentsToday) {
        for (const crewId of assignment.assignedCrewIds) {
          if (!assignmentByCrewId.has(crewId)) {
            assignmentByCrewId.set(crewId, assignment);
          }
        }

        for (const employeeId of assignment.assignedEmployeeIds) {
          if (!assignmentByEmployeeId.has(employeeId)) {
            assignmentByEmployeeId.set(employeeId, assignment);
          }
        }
      }

      const clockByEmployeeId = new Map(clockRows.map((row) => [row.employeeId, row]));
      const travelByCrewId = new Map(travelRows.map((row) => [row.crewId, row.state]));
      const employeeNameById = new Map(employeeDirectory.items.map((employee) => [employee.id, employee.fullName]));
      const crewNameById = new Map(crewDirectory.items.map((crew) => [crew.id, crew.name]));

      const crewStatus: CrewStatusRow[] = crewDirectory.items.map((crew) => {
        const assignment = assignmentByCrewId.get(crew.id) || null;
        const gpsState = travelByCrewId.get(crew.id);
        const derivedShiftStatus = deriveShiftStatus({
          assignmentStatus: crew.currentAssignmentStatus,
          isActive: crew.isActive,
          availability: crew.availability,
          assignmentTitle: crew.currentAssignmentTitle,
        });

        const shiftStatus = shiftStatuses[crew.id]
          || (gpsState === "traveling" ? "traveling" : derivedShiftStatus);

        return {
          crewId: crew.id,
          crewName: crew.name,
          supervisorName: crew.supervisorName,
          currentProjectName: crew.currentProjectName,
          employeeCount: crew.activeMemberCount,
          status: toCrewOperationalStatus(shiftStatus),
          shiftStatus,
          shiftProgressPercent: assignment
            ? toShiftProgressPercent(assignment.plannedStart, assignment.plannedEnd, asOf)
            : 0,
          equipmentAssignedCount: crew.equipmentCount,
          assignmentStatus: crew.currentAssignmentStatus,
        };
      });

      const employeeStatus: EmployeeStatusRow[] = employeeDirectory.items.map((employee) => {
        const assignment = assignmentByEmployeeId.get(employee.id) || null;
        const clock = clockByEmployeeId.get(employee.id) || null;
        const late = isLateEmployee(employeeDirectory.assignmentViews.find((view) => view.employeeId === employee.id && view.isCurrent) || null, asOf);

        const currentStatus: EmployeeStatusRow["currentStatus"] = employee.employmentStatus === "leave"
          ? "off"
          : employee.availabilityStatus === "unavailable"
            ? "absent"
            : late
              ? "late"
              : employee.currentAssignmentStatus === "in_progress" || assignment
                ? "working"
                : "available";

        const hoursToday = clock?.hoursToday ?? assignment?.plannedLaborHours ?? 0;

        return {
          employeeId: employee.id,
          employeeName: employee.fullName,
          currentStatus,
          assignedCrewId: employee.primaryCrewId,
          assignedCrewName: employee.primaryCrewName,
          assignedProjectId: employee.currentProjectId || assignment?.scope.projectId || null,
          assignedJobName: employee.currentAssignmentTitle || assignment?.title || null,
          timeTodayHours: Number(hoursToday.toFixed(2)),
          overtime: hoursToday > 8,
          lastCheckIn: clock?.lastCheckIn || assignment?.plannedStart || null,
          contactPhone: null,
        };
      });

      const projectStaffing = buildProjectStaffingRows({
        assignments: assignmentsToday.map((assignment) => ({
          projectId: assignment.scope.projectId,
          projectName: assignment.scope.projectName,
          requiredHeadcount: assignment.requiredHeadcount,
          assignedEmployeeIds: assignment.assignedEmployeeIds,
        })),
      });

      const dailyOperations: DailyOperationRow[] = assignmentsToday.map((assignment) => {
        const notes = parseDailyNotes(assignment.notes || null);
        const crewName = assignment.assignedCrewIds[0]
          ? crewDirectory.items.find((item) => item.id === assignment.assignedCrewIds[0])?.name || null
          : null;

        return {
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          projectName: assignment.scope.projectName,
          shiftStart: assignment.startTime,
          shiftEnd: assignment.endTime,
          crewName,
          supervisorName: assignment.scope.supervisor || null,
          crewNotes: notes.crewNotes,
          supervisorNotes: notes.supervisorNotes,
          safetyNotes: assignment.safetyRequirement || notes.safetyNotes,
        };
      });

      const dailyAssignments = buildDailyAssignments({
        assignmentsToday,
        employeeNamesById: employeeNameById,
        crewNamesById: crewNameById,
      });

      const assignmentConflicts = buildAssignmentConflicts(schedulingPayload);
      const crewTaskBoards = buildCrewTaskBoards({
        crewStatus,
        assignments: schedulingPayload?.assignments || [],
      });

      const projectOperations = buildProjectOperationsRows({
        projectStaffing,
        assignmentsToday,
        crewStatus,
      });

      const activeAssignments = employeeDirectory.assignmentViews.filter((view) => view.bucket === "current");
      const lateCount = employeeStatus.filter((employee) => employee.currentStatus === "late").length;
      const absentCount = employeeStatus.filter((employee) => employee.currentStatus === "absent").length;
      const offCount = employeeStatus.filter((employee) => employee.currentStatus === "off").length;

      const openAssignments = (schedulingPayload?.openShifts.length || 0)
        + assignmentsToday.filter((assignment) => assignment.requiredHeadcount > assignment.assignedEmployeeIds.length).length;

      const summary = {
        activeEmployees: employeeDirectory.summary.activeToday,
        activeCrews: crewDirectory.summary.activeCrews,
        employeesClockedIn: activeAssignments.length,
        employeesOffToday: offCount,
        employeesLate: lateCount,
        employeesAbsent: absentCount,
        openAssignments,
        laborCostToday: cost.totalCost,
        averageCrewUtilization: schedulingPayload?.analytics.crewUtilization || 0,
        laborCostSource: cost.source,
      };

      const jobsAtRisk = findings?.findings
        .filter((finding) => finding.type === "UPCOMING_ASSIGNMENT_WITHOUT_STAFFING" || finding.type === "ACTIVE_CREW_WITHOUT_ASSIGNMENT")
        .slice(0, 6)
        .map((finding) => ({
          projectName: finding.affectedEntities[0]?.displayName || "Workforce assignment",
          reason: finding.observation,
        })) || [];

      const integrations: WorkforceOperationsIntegrations = {
        gpsSync: travelRows.length > 0 ? "connected" : "pending",
        timeClockSync: clockRows.length > 0 ? "connected" : "pending",
        mobileSync: mobile.onlineEmployeeIds.length > 0 ? "connected" : "pending",
      };

      const overdueItems = buildOverdueItems({
        employeeStatus,
        dailyAssignments,
        dailyOperations,
        crewStatus,
      });

      const commandCenter = buildCommandCenter({
        summary,
        crewStatus,
        projectStaffing,
        employeeStatus,
        overdueItems,
      });

      const orion = evaluateOrionWorkforceIntelligence({
        summary,
        crewStatus,
        employeeStatus,
        projectStaffing,
        projectOperations,
        overdueItems,
        assignmentConflicts,
        dailyAssignments,
        findings: findings?.findings || [],
        evaluatedAtIso: asOf.toISOString(),
      });

      let persistedRecommendations = orion.intelligence.recommendations;
      let persistedTimeline = orion.intelligence.timeline;
      const persistenceNotices: string[] = [];

      try {
        const persisted = await persistence.reconcileEvaluation({
          companyId,
          actorProfileId: workspace.userId,
          evaluatedAtIso: asOf.toISOString(),
          recommendations: orion.intelligence.recommendations,
          scores: orion.intelligence.scores,
          timeline: orion.intelligence.timeline,
        });

        persistedRecommendations = persisted.recommendations;
        persistedTimeline = persisted.timeline;
      } catch {
        persistenceNotices.push("Orion persistence is temporarily unavailable. Showing live deterministic evaluation only.");
      }

      return {
        summary,
        intelligence: {
          ...orion.intelligence,
          recommendations: persistedRecommendations,
          timeline: persistedTimeline,
        },
        crewStatus: crewStatus.sort((left, right) => left.crewName.localeCompare(right.crewName)),
        employeeStatus: employeeStatus.sort((left, right) => left.employeeName.localeCompare(right.employeeName)),
        dailyAssignments,
        assignmentConflicts,
        crewTaskBoards,
        projectStaffing,
        projectOperations,
        commandCenter: {
          ...commandCenter,
          ...orion.commandCenterExtensions,
        },
        overdueItems,
        options: {
          crewOptions: crewDirectory.items.map((crew) => ({ id: crew.id, label: crew.name })),
          employeeOptions: employeeDirectory.items.map((employee) => ({ id: employee.id, label: employee.fullName })),
          supervisorOptions: crewDirectory.options.supervisorOptions.map((option) => ({ id: option.id, label: option.label })),
          assignmentOptions: assignmentsToday.map((assignment) => ({
            id: assignment.id,
            label: `${assignment.title} (${assignment.scope.projectName})`,
            projectId: assignment.scope.projectId,
            projectName: assignment.scope.projectName,
          })),
        },
        dailyOperations,
        jobsAtRisk,
        partialNotices: [
          ...crewDirectory.partialNotices,
          ...employeeDirectory.partialNotices,
          ...(schedulingPayload ? [] : ["Scheduling payload is temporarily unavailable. Showing workforce baseline metrics only."]),
          ...(findings?.partialNotices || []),
          ...persistenceNotices,
        ],
        integrations,
        generatedAt: asOf.toISOString(),
      };
    },

    async assignEmployeeToCrew(input) {
      const { workspace, workforce } = await resolveRuntime();
      const today = new Date().toISOString().slice(0, 10);
      const activeMemberships = await workforce.listCrewMemberships(workspace.companyId, {
        employeeId: input.employeeId,
        status: "active",
      });

      const currentOnTarget = activeMemberships.find((membership) => membership.crew_id === input.crewId);

      for (const membership of activeMemberships) {
        if (membership.crew_id === input.crewId) {
          continue;
        }

        if (input.asPrimaryCrew) {
          await workforce.endCrewMembership(workspace.companyId, workspace.userId, membership.id, today);
        }
      }

      if (currentOnTarget) {
        await workforce.updateCrewMembership(workspace.companyId, workspace.userId, currentOnTarget.id, {
          role: input.role,
          is_primary: input.asPrimaryCrew,
          status: "active",
          ends_on: null,
        });
      } else {
        await workforce.addCrewMembership(workspace.companyId, workspace.userId, {
          crew_id: input.crewId,
          employee_id: input.employeeId,
          role: input.role,
          is_primary: input.asPrimaryCrew,
          starts_on: today,
          status: "active",
        });
      }

      if (input.asPrimaryCrew) {
        await workforce.updateEmployee(workspace.companyId, workspace.userId, input.employeeId, {
          primary_crew_id: input.crewId,
        });
      }
    },

    async reassignEmployeeToCrew(input) {
      await this.assignEmployeeToCrew({
        employeeId: input.employeeId,
        crewId: input.crewId,
        role: input.role,
        asPrimaryCrew: true,
      });
    },

    async removeEmployeeFromCrew(input) {
      const { workspace, workforce } = await resolveRuntime();
      const today = new Date().toISOString().slice(0, 10);
      const activeMemberships = await workforce.listCrewMemberships(workspace.companyId, {
        employeeId: input.employeeId,
        crewId: input.crewId,
        status: "active",
      });

      for (const membership of activeMemberships) {
        await workforce.endCrewMembership(workspace.companyId, workspace.userId, membership.id, today);
      }

      const employee = await workforce.getEmployee(workspace.companyId, input.employeeId);
      if (employee?.primary_crew_id === input.crewId) {
        await workforce.updateEmployee(workspace.companyId, workspace.userId, input.employeeId, {
          primary_crew_id: null,
        });
      }
    },

    async moveEmployeeBetweenProjects(input) {
      const schedulingService = createSchedulingService();
      const payload = await schedulingService.getScheduling();

      const fromAssignment = payload.assignments.find((assignment) => assignment.id === input.fromAssignmentId);
      const toAssignment = payload.assignments.find((assignment) => assignment.id === input.toAssignmentId);

      if (!fromAssignment || !toAssignment) {
        throw new Error("Unable to find source or destination assignment.");
      }

      if (!fromAssignment.assignedEmployeeIds.includes(input.employeeId)) {
        throw new Error("Selected employee is not assigned to the source project assignment.");
      }

      const fromEmployeeIds = fromAssignment.assignedEmployeeIds.filter((employeeId) => employeeId !== input.employeeId);
      const toEmployeeIds = toAssignment.assignedEmployeeIds.includes(input.employeeId)
        ? toAssignment.assignedEmployeeIds
        : [...toAssignment.assignedEmployeeIds, input.employeeId];

      await schedulingService.moveAssignment(fromAssignment.id, {
        assignedEmployeeIds: fromEmployeeIds,
      });

      await schedulingService.moveAssignment(toAssignment.id, {
        assignedEmployeeIds: toEmployeeIds,
      });
    },

    async assignSupervisorToCrew(input) {
      const { workspace, workforce } = await resolveRuntime();
      await workforce.updateCrew(workspace.companyId, workspace.userId, input.crewId, {
        supervisor_profile_id: input.supervisorProfileId,
      });
    },

    async assignEquipmentToCrew(input) {
      const { workspace } = await resolveRuntime();
      const asOf = new Date();
      await equipmentDispatch.assignCrewEquipment({
        companyId: workspace.companyId,
        asOf,
      }, input);
    },

    async setCrewShiftStatus(input) {
      const { workspace } = await resolveRuntime();
      const asOf = new Date();
      await shiftState.setCrewStatus({
        companyId: workspace.companyId,
        asOf,
      }, input);
    },

    async acknowledgeRecommendation(input) {
      const { supabase, workspace } = await resolveRuntime();
      const persistence = createWorkforceIntelligencePersistenceService(supabase);
      await persistence.acknowledgeRecommendation({
        companyId: workspace.companyId,
        recommendationId: input.recommendationId,
        actorProfileId: workspace.userId,
        note: input.note,
      });
    },

    async acceptRecommendation(input) {
      const { supabase, workspace } = await resolveRuntime();
      const persistence = createWorkforceIntelligencePersistenceService(supabase);
      await persistence.acceptRecommendation({
        companyId: workspace.companyId,
        recommendationId: input.recommendationId,
        actorProfileId: workspace.userId,
        note: input.note,
      });
    },

    async dismissRecommendation(input) {
      const { supabase, workspace } = await resolveRuntime();
      const persistence = createWorkforceIntelligencePersistenceService(supabase);
      await persistence.dismissRecommendation({
        companyId: workspace.companyId,
        recommendationId: input.recommendationId,
        actorProfileId: workspace.userId,
        note: input.note,
      });
    },

    async completeRecommendation(input) {
      const { supabase, workspace } = await resolveRuntime();
      const persistence = createWorkforceIntelligencePersistenceService(supabase);
      await persistence.completeRecommendation({
        companyId: workspace.companyId,
        recommendationId: input.recommendationId,
        actorProfileId: workspace.userId,
        note: input.note,
      });
    },

    async recordRecommendationOutcome(input) {
      const { supabase, workspace } = await resolveRuntime();
      const persistence = createWorkforceIntelligencePersistenceService(supabase);
      await persistence.recordRecommendationOutcome({
        companyId: workspace.companyId,
        recommendationId: input.recommendationId,
        actorProfileId: workspace.userId,
        outcomeStatus: input.outcomeStatus,
        note: input.note,
      });
    },
  };
}

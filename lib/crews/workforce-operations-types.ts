import type { WorkforceAssignmentStatus } from "@/lib/workforce";

export type WorkforceCrewOperationalStatus =
  | "shift_started"
  | "traveling"
  | "working"
  | "lunch"
  | "break"
  | "finished"
  | "off_duty"
  | "completed"
  | "offline";
export type WorkforceShiftStatus = "shift_started" | "traveling" | "working" | "lunch" | "break" | "finished" | "off_duty";

export type WorkforceSummaryMetrics = {
  activeEmployees: number;
  activeCrews: number;
  employeesClockedIn: number;
  employeesOffToday: number;
  employeesLate: number;
  employeesAbsent: number;
  openAssignments: number;
  laborCostToday: number | null;
  averageCrewUtilization: number;
  laborCostSource: "live" | "estimated" | "unavailable";
};

export type CrewStatusRow = {
  crewId: string;
  crewName: string;
  supervisorName: string | null;
  currentProjectName: string | null;
  employeeCount: number;
  status: WorkforceCrewOperationalStatus;
  shiftStatus: WorkforceShiftStatus;
  shiftProgressPercent: number;
  equipmentAssignedCount: number;
  assignmentStatus: WorkforceAssignmentStatus | null;
};

export type EmployeeStatusRow = {
  employeeId: string;
  employeeName: string;
  currentStatus: "working" | "late" | "absent" | "available" | "off";
  assignedCrewId: string | null;
  assignedCrewName: string | null;
  assignedProjectId: string | null;
  assignedJobName: string | null;
  timeTodayHours: number;
  overtime: boolean;
  lastCheckIn: string | null;
  contactPhone: string | null;
};

export type ProjectStaffingRow = {
  projectId: string;
  projectName: string;
  requiredWorkers: number;
  assignedWorkers: number;
  staffingHealth: "healthy" | "watch" | "risk";
  openPositions: number;
  laborBudget: number | null;
  atRisk: boolean;
};

export type DailyOperationRow = {
  assignmentId: string;
  assignmentTitle: string;
  projectName: string;
  shiftStart: string;
  shiftEnd: string;
  crewName: string | null;
  supervisorName: string | null;
  crewNotes: string | null;
  supervisorNotes: string | null;
  safetyNotes: string | null;
};

export type WorkforceOperationsIntegrations = {
  gpsSync: "connected" | "pending" | "unavailable";
  timeClockSync: "connected" | "pending" | "unavailable";
  mobileSync: "connected" | "pending" | "unavailable";
};

export type WorkforceOperationsDashboardData = {
  summary: WorkforceSummaryMetrics;
  intelligence: OrionWorkforceIntelligence;
  crewStatus: CrewStatusRow[];
  employeeStatus: EmployeeStatusRow[];
  dailyAssignments: DailyAssignmentRow[];
  assignmentConflicts: AssignmentConflictRow[];
  crewTaskBoards: CrewTaskBoardRow[];
  projectStaffing: ProjectStaffingRow[];
  projectOperations: ProjectOperationsRow[];
  commandCenter: CommandCenterWidgets;
  overdueItems: OverdueItems;
  options: WorkforceOperationsOptions;
  dailyOperations: DailyOperationRow[];
  jobsAtRisk: Array<{ projectName: string; reason: string }>;
  partialNotices: string[];
  integrations: WorkforceOperationsIntegrations;
  generatedAt: string;
};

export type DailyAssignmentRow = {
  assignmentId: string;
  title: string;
  projectId: string;
  projectName: string;
  crewId: string | null;
  crewName: string | null;
  assignedEmployeeIds: string[];
  assignedEmployeeNames: string[];
  requiredHeadcount: number;
  missingHeadcount: number;
  status: "draft" | "published" | "in_progress" | "completed" | "cancelled";
  startTime: string;
  endTime: string;
};

export type AssignmentConflictRow = {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  type: string;
  title: string;
  explanation: string;
  relatedProjectId: string | null;
  relatedCrewId: string | null;
  relatedEmployeeId: string | null;
  resolutionStatus: "open" | "acknowledged" | "dismissed" | "resolved";
};

export type CrewTaskBoards = {
  todaysTasks: Array<{ assignmentId: string; title: string; projectName: string }>;
  upcomingTasks: Array<{ assignmentId: string; title: string; projectName: string }>;
  completedTasks: Array<{ assignmentId: string; title: string; projectName: string }>;
  safetyItems: string[];
  supervisorNotes: string[];
};

export type CrewTaskBoardRow = {
  crewId: string;
  crewName: string;
  tasks: CrewTaskBoards;
};

export type ProjectOperationsRow = {
  projectId: string;
  projectName: string;
  crewAssigned: number;
  requiredWorkers: number;
  missingWorkers: number;
  equipmentAssigned: number;
  scheduleStatus: "on_track" | "watch" | "at_risk";
  laborProgress: number;
};

export type CommandCenterWidgets = {
  todaysWorkforce: {
    activeEmployees: number;
    activeCrews: number;
    openStaffingIssues: number;
  };
  crewsRequiringAttention: Array<{ crewId: string; crewName: string; reason: string }>;
  projectsAtRisk: Array<{ projectId: string; projectName: string; reason: string }>;
  employeesRequiringAction: Array<{ employeeId: string; employeeName: string; reason: string }>;
  openStaffingIssues: Array<{ projectName: string; missingWorkers: number }>;
  todaysRisks: Array<{ id: string; title: string; severity: "critical" | "high" | "medium" | "low" }>;
  todaysOpportunities: Array<{ id: string; title: string; impact: string }>;
  criticalWorkforceAlerts: Array<{ id: string; title: string; explanation: string }>;
  recommendedSupervisorActions: Array<{ id: string; action: string; priority: "critical" | "high" | "medium" | "low" }>;
  upcomingStaffingIssues: Array<{ projectName: string; startsAt: string; missingWorkers: number }>;
  forecastedLaborShortages: Array<{ projectName: string; shortageCount: number; confidence: number }>;
};

export type OrionWorkforceScoreId =
  | "workforce_health"
  | "crew_efficiency"
  | "labor_utilization"
  | "attendance_reliability"
  | "staffing_risk"
  | "schedule_confidence"
  | "equipment_readiness"
  | "safety_readiness";

export type OrionWorkforceScore = {
  id: OrionWorkforceScoreId;
  label: string;
  value: number;
  trend: "up" | "down" | "flat";
  confidence: number;
  explanation: string;
  recommendedAction: string;
};

export type OrionRecommendationType =
  | "move_employee_to_another_crew"
  | "reassign_supervisor"
  | "add_additional_workers"
  | "remove_excess_labor"
  | "shift_equipment"
  | "delay_assignment"
  | "start_assignment_early"
  | "resolve_staffing_conflicts"
  | "reduce_overtime";

export type OrionRecommendationStatus =
  | "open"
  | "acknowledged"
  | "accepted"
  | "dismissed"
  | "completed"
  | "expired";

export type OrionRecommendationOutcomeStatus =
  | "pending"
  | "successful"
  | "partial"
  | "unsuccessful"
  | "unknown";

export type OrionRecommendation = {
  id: string;
  originalRecommendationId?: string;
  fingerprint?: string;
  type: OrionRecommendationType;
  title: string;
  reason: string;
  priority: "critical" | "high" | "medium" | "low";
  expectedImpact: string;
  confidence: number;
  status?: OrionRecommendationStatus;
  affectedCrewId?: string | null;
  affectedEmployeeId?: string | null;
  affectedProjectId?: string | null;
  createdAt?: string;
  acknowledgedAt?: string | null;
  acceptedAt?: string | null;
  dismissedAt?: string | null;
  completedAt?: string | null;
  expiredAt?: string | null;
  actorProfileId?: string | null;
  outcomeStatus?: OrionRecommendationOutcomeStatus | null;
  outcomeNotes?: string | null;
};

export type WorkforceTimelineEventType =
  | "shift_started"
  | "traveling"
  | "working"
  | "break"
  | "lunch"
  | "completed"
  | "late"
  | "absent"
  | "equipment_assigned"
  | "supervisor_changed"
  | "crew_reassigned";

export type WorkforceTimelineEvent = {
  id: string;
  type: WorkforceTimelineEventType;
  timestamp: string;
  title: string;
  detail: string;
  severity: "critical" | "high" | "medium" | "low";
  crewId?: string | null;
  employeeId?: string | null;
  projectId?: string | null;
  assignmentId?: string | null;
  actorProfileId?: string | null;
  metadata?: Record<string, unknown>;
  source?: string;
};

export type OrionWorkforceIntelligence = {
  scores: OrionWorkforceScore[];
  recommendations: OrionRecommendation[];
  timeline: WorkforceTimelineEvent[];
};

export type OverdueItems = {
  lateEmployees: Array<{ employeeId: string; employeeName: string }>;
  missingCheckIns: Array<{ employeeId: string; employeeName: string }>;
  missingAssignments: Array<{ employeeId: string; employeeName: string }>;
  safetyFlags: Array<{ assignmentId: string; assignmentTitle: string }>;
  missingEquipment: Array<{ crewId: string; crewName: string }>;
};

export type WorkforceOperationsOptions = {
  crewOptions: Array<{ id: string; label: string }>;
  employeeOptions: Array<{ id: string; label: string }>;
  supervisorOptions: Array<{ id: string; label: string }>;
  assignmentOptions: Array<{ id: string; label: string; projectId: string; projectName: string }>;
};

export type AssignEmployeeToCrewInput = {
  employeeId: string;
  crewId: string;
  role: string;
  asPrimaryCrew: boolean;
};

export type RemoveEmployeeFromCrewInput = {
  employeeId: string;
  crewId: string;
};

export type MoveEmployeeProjectInput = {
  employeeId: string;
  fromAssignmentId: string;
  toAssignmentId: string;
};

export type AssignSupervisorInput = {
  crewId: string;
  supervisorProfileId: string;
};

export type AssignEquipmentInput = {
  crewId: string;
  equipmentIds: string[];
};

export type SetCrewShiftStatusInput = {
  crewId: string;
  status: WorkforceShiftStatus;
};

export type WorkforceEquipmentDispatchInterface = {
  assignCrewEquipment: (
    context: WorkforceOperationsInterfaceContext,
    input: AssignEquipmentInput,
  ) => Promise<{ success: boolean }>;
};

export type WorkforceShiftStateProvider = {
  getCrewStatuses: (context: WorkforceOperationsInterfaceContext) => Promise<Record<string, WorkforceShiftStatus>>;
  setCrewStatus: (context: WorkforceOperationsInterfaceContext, input: SetCrewShiftStatusInput) => Promise<void>;
};

export type WorkforceOperationsInterfaceContext = {
  companyId: string;
  asOf: Date;
};

export type WorkforceGpsSyncInterface = {
  getCrewTravelState: (
    context: WorkforceOperationsInterfaceContext,
  ) => Promise<Array<{ crewId: string; state: "traveling" | "on_site" | "offline" }>>;
};

export type WorkforceTimeClockInterface = {
  getDailyCheckIns: (
    context: WorkforceOperationsInterfaceContext,
  ) => Promise<Array<{ employeeId: string; lastCheckIn: string | null; hoursToday: number | null }>>;
};

export type WorkforceMobileSyncInterface = {
  getConnectivitySnapshot: (
    context: WorkforceOperationsInterfaceContext,
  ) => Promise<{ onlineEmployeeIds: string[] }>;
};

export type WorkforceLaborCostInterface = {
  getLaborCostToday: (
    context: WorkforceOperationsInterfaceContext,
  ) => Promise<{ totalCost: number | null; source: "live" | "estimated" | "unavailable" }>;
};

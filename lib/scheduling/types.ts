export const ASSIGNMENT_TYPES = [
  "project_work",
  "crew_mobilization",
  "inspection",
  "delivery",
  "training",
  "toolbox_talk",
  "maintenance",
  "meeting",
  "milestone",
  "time_off",
  "open_shift",
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const ASSIGNMENT_STATUSES = ["draft", "published", "in_progress", "completed", "cancelled"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const SCHEDULE_VIEWS = ["day", "week", "month"] as const;
export type ScheduleView = (typeof SCHEDULE_VIEWS)[number];

export const SCHEDULE_GROUPS = ["project", "crew", "employee", "trade", "location"] as const;
export type ScheduleGroup = (typeof SCHEDULE_GROUPS)[number];

export const DISPATCH_STATUSES = ["available", "assigned", "in_transit", "on_site", "delayed", "completed", "off_shift"] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export const CONFLICT_SEVERITIES = ["critical", "high", "medium", "low", "informational"] as const;
export type ConflictSeverity = (typeof CONFLICT_SEVERITIES)[number];

export const CONFLICT_TYPES = [
  "employee_double_booking",
  "crew_double_booking",
  "overlapping_assignments",
  "employee_pto_conflict",
  "training_conflict",
  "certification_expired",
  "certification_expiring",
  "incompatible_trade",
  "excessive_travel_time",
  "insufficient_travel_buffer",
  "overtime_threshold_risk",
  "crew_over_capacity",
  "understaffed_project",
  "overstaffed_project",
  "supervisor_conflict",
  "shift_overlap",
  "holiday_conflict",
  "equipment_conflict",
  "inspection_conflict",
  "delivery_conflict",
] as const;

export type ConflictType = (typeof CONFLICT_TYPES)[number];

export type AssignmentRecurrence = {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  endDate: string | null;
};

export type EquipmentRequirement = {
  requiredEquipment: string[];
  assignedEquipment: string[];
  operatorRequired: boolean;
};

export type TimeOffType = "pto" | "sick" | "training" | "restricted_duty" | "unavailable" | "blocked_time";

export type TimeOffEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: TimeOffType;
  start: string;
  end: string;
  partialDay: boolean;
  reason: string;
};

export type AssignmentScope = {
  projectId: string;
  projectName: string;
  location: string;
  supervisor: string;
};

export type ScheduleAssignment = {
  id: string;
  title: string;
  type: AssignmentType;
  status: AssignmentStatus;
  shift: "day" | "swing" | "night";
  priority: "low" | "medium" | "high" | "critical";
  date: string;
  startTime: string;
  endTime: string;
  plannedStart: string;
  plannedEnd: string;
  plannedLaborHours: number;
  requiredHeadcount: number;
  requiredTrade: string;
  assignedCrewIds: string[];
  assignedEmployeeIds: string[];
  scope: AssignmentScope;
  notes: string;
  travelTimeMinutes: number;
  recurrence: AssignmentRecurrence;
  safetyRequirement: string;
  certificationRequirement: string;
  equipment: EquipmentRequirement;
  isOpenShift: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DispatchResourceType = "crew" | "employee" | "equipment" | "delivery";

export type DispatchResource = {
  id: string;
  type: DispatchResourceType;
  resourceId: string;
  name: string;
  trade: string;
  specialty: string;
  status: DispatchStatus;
  currentAssignmentId: string | null;
  currentAssignmentTitle: string | null;
  destination: string;
  shift: "day" | "swing" | "night";
  startTime: string;
  estimatedTravelMinutes: number;
  utilization: number;
  alerts: string[];
  certificationWarnings: string[];
  contact: string;
  relatedProjectId: string | null;
  relatedProjectName: string | null;
  delayReason: string | null;
};

export type ScheduleConflict = {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  explanation: string;
  affectedResources: string[];
  affectedAssignments: string[];
  recommendedAction: string;
  resolutionStatus: "open" | "acknowledged" | "dismissed" | "resolved";
  relatedProjectId: string | null;
  relatedCrewId: string | null;
  relatedEmployeeId: string | null;
};

export type OpenShift = {
  id: string;
  assignmentId: string;
  projectId: string;
  projectName: string;
  tradeRequired: string;
  workersNeeded: number;
  date: string;
  shift: "day" | "swing" | "night";
  startTime: string;
  endTime: string;
  location: string;
  urgency: "low" | "medium" | "high" | "critical";
  supervisor: string;
  certificationRequirements: string[];
  estimatedHours: number;
  reason: string;
  candidateEmployeeIds: string[];
  candidateCrewIds: string[];
  dismissed: boolean;
};

export type ResourceAvailability = {
  id: string;
  resourceType: "crew" | "employee";
  resourceId: string;
  name: string;
  trade: string;
  location: string;
  shift: "day" | "swing" | "night";
  availability: "available" | "partial" | "unavailable" | "pto" | "training" | "on_call";
  availableFrom: string;
  availableTo: string;
  overtimeEligible: boolean;
  certificationSummary: string;
  utilization: number;
};

export type SchedulingInsight = {
  id: string;
  title: string;
  category: "staffing" | "dispatch" | "conflict" | "productivity";
  severity: ConflictSeverity;
  explanation: string;
  expectedImpact: string;
  affectedResources: string[];
  recommendedAction: string;
  confidence: number;
  status: "open" | "accepted" | "dismissed";
};

export type ScheduleHealthBreakdown = {
  unresolvedConflicts: number;
  openShifts: number;
  understaffedProjects: number;
  overstaffedProjects: number;
  overtimeRisks: number;
  certificationRisks: number;
  travelConflicts: number;
  lateDispatches: number;
  utilizationBalancePenalty: number;
};

export type ScheduleHealth = {
  score: number;
  statusLabel: "Excellent" | "Healthy" | "Needs Attention" | "At Risk" | "Critical";
  breakdown: ScheduleHealthBreakdown;
  biggestRisks: string[];
  strongestAreas: string[];
  recommendedImprovements: string[];
  isMock: true;
};

export type LaborDemand = {
  key: string;
  label: string;
  requiredHeadcount: number;
  scheduledHeadcount: number;
  availableHeadcount: number;
  laborShortage: number;
  laborSurplus: number;
  overtimeForecast: number;
  utilizationForecast: number;
  openShifts: number;
  upcomingPto: number;
  expiringCertifications: number;
};

export type LaborForecastRange = "tomorrow" | "7d" | "14d" | "30d";

export type LaborForecast = {
  range: LaborForecastRange;
  summaryCards: Array<{ id: string; label: string; value: string; trend: string; status: "good" | "watch" | "risk" }>;
  demandByTrade: LaborDemand[];
  demandByProject: LaborDemand[];
  demandByCrew: LaborDemand[];
  demandByLocation: LaborDemand[];
  demandByShift: LaborDemand[];
  risks: string[];
};

export type SchedulingAnalytics = {
  laborUtilization: number;
  crewUtilization: number;
  idleTimeHours: number;
  overtimeRiskCount: number;
  assignmentCompletionRate: number;
  openShiftFillRate: number;
  scheduleConflictCount: number;
  averageReassignmentCount: number;
  understaffingCount: number;
  overstaffingCount: number;
  scheduleHealth: number;
  travelEfficiencyPlaceholder: number;
  dispatchPunctuality: number;
  missedStartTimesPlaceholder: number;
  previousPeriodDelta: Record<string, number>;
};

export type ScheduleFilterState = {
  query: string;
  project: string;
  crew: string;
  employeeTrade: string;
  shift: "all" | "day" | "swing" | "night";
  status: "all" | AssignmentStatus;
  groupBy: ScheduleGroup;
};

export type AssignmentDraft = {
  title: string;
  type: AssignmentType;
  projectId: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  shift: "day" | "swing" | "night";
  assignedCrewIds: string[];
  assignedEmployeeIds: string[];
  requiredTrade: string;
  requiredHeadcount: number;
  supervisor: string;
  priority: "low" | "medium" | "high" | "critical";
  status: AssignmentStatus;
  notes: string;
  travelTimeMinutes: number;
  recurrence: AssignmentRecurrence;
  equipment: EquipmentRequirement;
  safetyRequirement: string;
  certificationRequirement: string;
};

export type SchedulingSummary = {
  dateRangeLabel: string;
  operationalSummary: string;
  companyContext: string;
  branchContext: string;
  kpis: Array<{
    id:
      | "employeesScheduled"
      | "crewsAssigned"
      | "availableEmployees"
      | "availableCrews"
      | "openShifts"
      | "conflicts"
      | "overtimeRisk"
      | "understaffedProjects"
      | "overstaffedProjects"
      | "scheduleHealth";
    labelKey: string;
    value: string;
    insightKey: string;
    trendKey: string;
    status: "good" | "watch" | "risk";
  }>;
};

export type SchedulingPayload = {
  summary: SchedulingSummary;
  assignments: ScheduleAssignment[];
  dispatch: DispatchResource[];
  openShifts: OpenShift[];
  conflicts: ScheduleConflict[];
  availability: ResourceAvailability[];
  insights: SchedulingInsight[];
  health: ScheduleHealth;
  analytics: SchedulingAnalytics;
  projectOptions: Array<{ id: string; name: string }>;
  crewOptions: Array<{ id: string; name: string }>;
  employeeOptions: Array<{ id: string; name: string; trade: string }>;
  tradeOptions: string[];
};

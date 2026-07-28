export type OperationsShift = "day" | "swing" | "night";

export type OperationsKpiStatus = "good" | "watch" | "critical" | "neutral";

export type OperationsKpi = {
  id:
    | "activeProjects"
    | "crewsWorking"
    | "crewsAvailable"
    | "employeesScheduled"
    | "employeesAvailable"
    | "scheduleConflicts"
    | "safetyAlerts"
    | "certificationRisks"
    | "delayedActivities"
    | "sitecamUpdates";
  label: string;
  value: string;
  insight: string;
  trend: string;
  status: OperationsKpiStatus;
};

export type OperationsSummary = {
  dateLabel: string;
  dailySummary: string;
  companyContext: string;
  locationContext: string;
  kpis: OperationsKpi[];
};

export type ProjectRiskLevel = "low" | "medium" | "high";
export type ProjectScheduleStatus = "on_track" | "at_risk" | "delayed";

export type DailyProjectOperation = {
  id: string;
  projectName: string;
  location: string;
  projectManager: string;
  superintendent: string;
  assignedCrews: string[];
  manpowerPlanned: number;
  manpowerActual: number;
  keyActivity: string;
  scheduleStatus: ProjectScheduleStatus;
  completionPercentage: number;
  riskLevel: ProjectRiskLevel;
  weatherImpact: string;
  latestSitecamActivity: string;
  nextMilestone: string;
};

export type CrewOperationalStatus = "on_site" | "in_transit" | "available" | "training" | "off_shift" | "delayed" | "overallocated";

export type CrewAllocation = {
  crewId: string;
  crewName: string;
  crewLead: string;
  assignedProject: string | null;
  shift: OperationsShift;
  startTime: string;
  plannedHours: number;
  utilization: number;
  status: CrewOperationalStatus;
  availability: "available" | "assigned" | "off_shift" | "pto" | "training" | "unavailable";
  scheduleConflicts: number;
  certificationWarnings: number;
};

export type WorkforceAttentionType = "no_show_risk" | "overtime_risk" | "certification_issue" | "unassigned" | "crew_conflict";

export type WorkforceAttentionItem = {
  employeeId: string;
  fullName: string;
  type: WorkforceAttentionType;
  reason: string;
  owner: string;
};

export type WorkforceStatus = {
  scheduled: number;
  checkedIn: number;
  available: number;
  absent: number;
  pto: number;
  training: number;
  overtimeRisk: number;
  certificationRisk: number;
  attention: WorkforceAttentionItem[];
};

export type ScheduleStatus = "upcoming" | "in_progress" | "complete" | "delayed" | "at_risk" | "cancelled";
export type SchedulePeriod = "morning" | "midday" | "afternoon" | "evening";

export type ScheduleEvent = {
  id: string;
  time: string;
  activity: string;
  project: string;
  assignedCrew: string;
  owner: string;
  status: ScheduleStatus;
  priority: "low" | "medium" | "high" | "critical";
  hasConflict: boolean;
  period: SchedulePeriod;
};

export type SafetySeverity = "critical" | "high" | "medium" | "low";

export type SafetyAlert = {
  id: string;
  title: string;
  severity: SafetySeverity;
  project: string;
  subject: string;
  dueDate: string;
  owner: string;
  recommendedAction: string;
  status: "open" | "in_progress" | "resolved";
};

export type SiteCamActivity = {
  id: string;
  projectId: string;
  project: string;
  timestamp: string;
  uploader: string;
  photoCount: number;
  category: "concrete" | "framing" | "safety" | "delivery" | "inspection" | "punchlist";
  description: string;
  flagged: boolean;
};

export type OperationsInsight = {
  id: string;
  category: "schedule" | "labor" | "safety" | "compliance" | "progress";
  severity: SafetySeverity;
  title: string;
  explanation: string;
  recommendedAction: string;
  relatedEntity: string;
  confidence: string;
  isMock: boolean;
};

export type AttentionScope = "all" | "critical" | "today" | "projects" | "crews" | "workforce" | "safety";

export type AttentionItem = {
  id: string;
  priority: SafetySeverity;
  title: string;
  reason: string;
  relatedEntity: string;
  owner: string;
  dueAt: string;
  suggestedAction: string;
  status: "open" | "in_progress" | "resolved";
  scope: Exclude<AttentionScope, "all" | "critical" | "today"> | "today";
};

export type OperationsFilters = {
  date: string;
  shift: OperationsShift | "all";
  project: string;
  query: string;
};

export type OperationsPayload = {
  summary: OperationsSummary;
  projects: DailyProjectOperation[];
  crewAllocations: CrewAllocation[];
  workforce: WorkforceStatus;
  schedule: ScheduleEvent[];
  safetyAlerts: SafetyAlert[];
  sitecamActivity: SiteCamActivity[];
  insights: OperationsInsight[];
  attentionQueue: AttentionItem[];
  schedulingIntegration: {
    crewsWorking: number;
    employeesScheduled: number;
    openShifts: number;
    scheduleConflicts: number;
    delayedAssignments: number;
    overtimeRisk: number;
    understaffedProjects: number;
    dispatchDelayed: number;
  };
  projectOptions: string[];
};

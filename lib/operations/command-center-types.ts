import type { DashboardActivityItem, ScheduleEvent as DashboardScheduleEvent } from "@/lib/dashboard/types";
import type { ExecutiveBrief } from "@/lib/orion/executive-brief-types";

export type DataAvailability = "live" | "partial" | "unavailable";

export type CommandCenterFocusFilter = "all" | "critical" | "today" | "projects" | "workforce" | "approvals";

export type SummaryMetricTone = "default" | "success" | "warning" | "danger" | "muted";

export type OperationsSummaryMetric = {
  id:
    | "activeProjects"
    | "projectsAtRisk"
    | "tasksDueToday"
    | "overdueTasks"
    | "assignedWorkforce"
    | "unassignedWork"
    | "scheduleEventsToday"
    | "pendingApprovals"
    | "newSitecamActivity"
    | "operationalAlerts"
    | "equipmentInUse"
    | "equipmentMaintenanceDue"
    | "equipmentConflicts";
  label: string;
  value: number | null;
  availability: DataAvailability;
  href: string;
  tone: SummaryMetricTone;
  description?: string;
};

export type OperationsPrioritySeverity = "critical" | "high" | "medium" | "low";

export type PriorityActionItem = {
  id: string;
  title: string;
  sourceModule: string;
  severity: OperationsPrioritySeverity;
  projectName: string | null;
  owner: string | null;
  dueAt: string | null;
  ageHours: number | null;
  recommendedAction: string;
  href: string;
  focus: CommandCenterFocusFilter;
  rank: number;
};

export type LiveProjectStatusRow = {
  id: string;
  projectName: string;
  customerName: string;
  healthScore: number;
  progressPercent: number;
  riskLevel: "low" | "medium" | "high";
  currentPhase: string;
  overdueTaskCount: number;
  blockedTaskCount: number;
  assignedWorkerCount: number | null;
  latestActivityAt: string | null;
  nextMilestone: string | null;
  scheduleVarianceLabel: string | null;
  href: string;
};

export type WorkforceBoardRow = {
  profileId: string;
  fullName: string;
  assignedProject: string | null;
  currentTask: string | null;
  currentPhase: string | null;
  scheduledHours: number | null;
  timeLoggedHours: number | null;
  taskCount: number;
  status: "assigned" | "unassigned" | "overloaded";
  hasConflict: boolean;
  href: string;
};

export type PendingDecisionItem = {
  id: string;
  title: string;
  decisionType: "change_order" | "estimate" | "invoice" | "task" | "equipment";
  severity: OperationsPrioritySeverity;
  projectName: string | null;
  owner: string | null;
  dueAt: string | null;
  href: string;
};

export type SectionAvailabilityMap = {
  header: DataAvailability;
  summary: DataAvailability;
  priorityQueue: DataAvailability;
  projectStatus: DataAvailability;
  workforce: DataAvailability;
  schedule: DataAvailability;
  activityFeed: DataAvailability;
  pendingDecisions: DataAvailability;
  orionBrief: DataAvailability;
};

export type OperationsCommandCenterData = {
  companyName: string;
  currentDateIso: string;
  lastRefreshedAt: string;
  operatingStatus: {
    label: string;
    tone: SummaryMetricTone;
  };
  healthIndicator: {
    score: number;
    label: string;
  };
  summaryMetrics: OperationsSummaryMetric[];
  priorityQueue: PriorityActionItem[];
  projectStatus: LiveProjectStatusRow[];
  workforceBoard: WorkforceBoardRow[];
  schedule: DashboardScheduleEvent[];
  activityFeed: DashboardActivityItem[];
  pendingDecisions: PendingDecisionItem[];
  orionBrief: ExecutiveBrief | null;
  projectOptions: Array<{ id: string; label: string }>;
  availability: SectionAvailabilityMap;
  partialNotices: string[];
};

export type OperationsCommandCenterResult = {
  data: OperationsCommandCenterData;
  permissionError: boolean;
};
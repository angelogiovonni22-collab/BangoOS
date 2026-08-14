import { createCrewService } from "@/lib/crews";
import { createEmployeeService } from "@/lib/employees";
import { getOperationsCommandCenter } from "./command-center-service";
import type { OperationsCommandCenterData } from "./command-center-types";
import type { PriorityActionItem } from "./command-center-types";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { EmployeeDashboardSummary } from "@/lib/employees";
import type {
  AttentionItem,
  CrewAllocation,
  DailyProjectOperation,
  OperationsFilters,
  OperationsPayload,
  OperationsInsight,
  OperationsKpi,
  ScheduleEvent,
  SafetyAlert,
  SiteCamActivity,
  WorkforceStatus,
} from "./types";

export type OperationsService = {
  getOperations: (filters: OperationsFilters) => Promise<OperationsPayload>;
};

const identityTranslator = (key: string) => key;

export function createOperationsService(): OperationsService {
  return {
    async getOperations(filters) {
      const supabase = createClient();

      if (!supabase) {
        throw new Error("Unable to connect to operations storage.");
      }

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        throw new Error(workspace.errorMessage || "Unable to resolve workspace context.");
      }

      const commandCenter = await getOperationsCommandCenter(supabase, workspace.context, "en-US", identityTranslator);
      const partialNotices = [...(commandCenter.data.partialNotices ?? [])];

      const crewService = createCrewService();
      const employeeService = createEmployeeService();

      const [crewDirectoryResult, employeeSummaryResult] = await Promise.allSettled([
        crewService.getCrews({
          query: filters.query,
          status: "all",
          leadId: "all",
          supervisorId: "all",
          projectId: "all",
          assignmentStatus: filters.shift === "all" ? "all" : "confirmed",
          sortBy: "name_asc",
          page: 1,
          pageSize: 200,
        }),
        employeeService.getSummary(),
      ]);

      const crewAllocations = crewDirectoryResult.status === "fulfilled"
        ? buildCrewAllocations(crewDirectoryResult.value.items, filters.shift)
        : [];

      if (crewDirectoryResult.status === "rejected") {
        partialNotices.push("Crew directory is partially unavailable right now.");
      }

      const employeeSummary = employeeSummaryResult.status === "fulfilled"
        ? employeeSummaryResult.value
        : null;

      if (employeeSummaryResult.status === "rejected") {
        partialNotices.push("Employee summary is partially unavailable right now.");
      }

      const projectCrewNames = groupByProject(crewAllocations, (allocation) => allocation.assignedProject);

      const projects = buildProjects(commandCenter.data.projectStatus, projectCrewNames);
      const schedule = buildSchedule(commandCenter.data.schedule, projectCrewNames);
      const priorityQueue = commandCenter.data.priorityQueue;
      const attentionQueue = buildAttentionQueue(priorityQueue);
      const insights = buildInsights(priorityQueue);
      const sitecamActivity = buildSitecamActivity(commandCenter.data.activityFeed);
      const safetyAlerts: SafetyAlert[] = [];
      const workforce = buildWorkforceStatus(crewAllocations, employeeSummary);
      const summary = buildSummary(filters, commandCenter.data, projects, crewAllocations, employeeSummary, workforce, schedule, sitecamActivity, priorityQueue);
      const schedulingIntegration = buildSchedulingIntegration(crewAllocations, schedule, projects);
      const projectOptions = ["all", ...dedupeStrings(commandCenter.data.projectOptions.map((option) => option.label))];

      return {
        summary,
        projects,
        crewAllocations,
        workforce,
        schedule,
        safetyAlerts,
        sitecamActivity,
        insights,
        attentionQueue,
        schedulingIntegration,
        projectOptions,
        partialNotices,
      };
    },
  };
}

function buildCrewAllocations(
  crews: Array<{ id: string; name: string; leadName: string | null; supervisorName: string | null; currentProjectName: string | null; activeMemberCount: number; hasEquipmentConflict: boolean; availability: "available" | "assigned"; isActive: boolean; currentAssignmentStatus: string | null; }>,
  shift: OperationsFilters["shift"],
): CrewAllocation[] {
  const resolvedShift = shift === "all" ? "day" : shift;

  return crews
    .map((crew) => {
      const utilization = crew.activeMemberCount > 0
        ? Math.min(100, crew.activeMemberCount * 12)
        : 0;

      return {
        crewId: crew.id,
        crewName: crew.name,
        crewLead: crew.leadName || crew.supervisorName || "",
        assignedProject: crew.currentProjectName,
        shift: resolvedShift,
        startTime: "",
        plannedHours: crew.activeMemberCount > 0 ? crew.activeMemberCount * 8 : 0,
        utilization,
        status: crew.hasEquipmentConflict
          ? "delayed"
          : crew.availability === "assigned"
            ? "on_site"
            : crew.isActive
              ? "available"
              : "off_shift",
        availability: crew.availability === "assigned" ? "assigned" : crew.isActive ? "available" : "unavailable",
        scheduleConflicts: crew.hasEquipmentConflict ? 1 : 0,
        certificationWarnings: 0,
      } satisfies CrewAllocation;
    })
    .sort((left, right) => right.utilization - left.utilization || left.crewName.localeCompare(right.crewName));
}

function buildProjects(
  projectStatus: OperationsCommandCenterData["projectStatus"],
  crewNamesByProject: Map<string, CrewAllocation[]>,
): DailyProjectOperation[] {
  return projectStatus.map((project) => {
    const crews = crewNamesByProject.get(project.projectName) ?? [];
    const totalMembers = crews.reduce((sum, crew) => sum + Math.max(0, Math.round(crew.plannedHours / 8)), 0);
    const activeMembers = crews.reduce((sum, crew) => sum + Math.max(0, Math.round(crew.utilization / 12)), 0);

    return {
      id: project.id,
      projectName: project.projectName,
      location: "",
      projectManager: crews[0]?.crewLead || "",
      superintendent: crews[0]?.crewLead || "",
      assignedCrews: crews.map((crew) => crew.crewName),
      manpowerPlanned: totalMembers,
      manpowerActual: activeMembers,
      keyActivity: project.currentPhase,
      scheduleStatus: project.riskLevel === "high" ? "delayed" : project.riskLevel === "medium" ? "at_risk" : "on_track",
      completionPercentage: project.progressPercent,
      riskLevel: project.riskLevel,
      weatherImpact: project.scheduleVarianceLabel || "",
      latestSitecamActivity: project.latestActivityAt || "",
      nextMilestone: project.nextMilestone || "",
    };
  });
}

function buildSchedule(
  scheduleItems: OperationsCommandCenterData["schedule"],
  crewNamesByProject: Map<string, CrewAllocation[]>,
): ScheduleEvent[] {
  return scheduleItems.map((item) => {
    const crews = crewNamesByProject.get(item.projectName) ?? [];
    const scheduleStatus: ScheduleEvent["status"] = item.status === "complete"
      ? "complete"
      : item.status === "travel"
        ? "at_risk"
        : item.status === "confirmed"
          ? "upcoming"
          : "upcoming";

    return {
      id: item.id,
      time: item.timeLabel,
      activity: item.title || item.titleKey || item.projectName,
      project: item.projectName,
      assignedCrew: crews.length > 0 ? crews.map((crew) => crew.crewName).join(", ") : "",
      owner: crews[0]?.crewLead || "",
      status: scheduleStatus,
      priority: scheduleStatus === "at_risk" ? "high" : scheduleStatus === "complete" ? "low" : crews.length > 0 ? "medium" : "low",
      hasConflict: scheduleStatus === "at_risk",
      period: mapSchedulePeriod(item.period),
    };
  });
}

function buildAttentionQueue(priorityQueue: PriorityActionItem[]): AttentionItem[] {
  return priorityQueue.map((item) => ({
    id: item.id,
    priority: item.severity,
    title: item.title,
    reason: item.recommendedAction,
    relatedEntity: item.projectName || item.sourceModule,
    owner: item.owner || "",
    dueAt: item.dueAt || "",
    suggestedAction: item.recommendedAction,
    status: item.severity === "critical" ? "open" : "in_progress",
    scope: item.focus === "today" ? "today" : item.focus === "workforce" ? "workforce" : "projects",
  }));
}

function buildInsights(priorityQueue: PriorityActionItem[]): OperationsInsight[] {
  return priorityQueue.slice(0, 8).map((item) => ({
    id: item.id,
    category: item.focus === "approvals" ? "progress" : item.focus === "workforce" ? "labor" : item.focus === "today" ? "schedule" : "progress",
    severity: item.severity,
    title: item.title,
    explanation: item.recommendedAction,
    recommendedAction: item.recommendedAction,
    relatedEntity: item.projectName || item.sourceModule,
    confidence: item.ageHours === null ? "Live operational signal" : `${Math.min(100, Math.max(50, 100 - item.ageHours))}% confidence`,
    isMock: false,
  }));
}

function buildSitecamActivity(activityFeed: OperationsCommandCenterData["activityFeed"]): SiteCamActivity[] {
  return activityFeed
    .filter((item) => item.category === "sitecam")
    .map((item) => ({
      id: item.id,
      projectId: extractProjectId(item.href),
      project: item.projectName || "",
      timestamp: new Date(Date.now() - item.timestampMinutesAgo * 60_000).toISOString(),
      uploader: item.user,
      photoCount: 1,
      category: "inspection",
      description: item.actionLabel || item.actionLabelKey || "",
      flagged: false,
    }));
}

function buildWorkforceStatus(
  crewAllocations: CrewAllocation[],
  employeeSummary: EmployeeDashboardSummary | null,
): WorkforceStatus {
  const scheduled = employeeSummary?.assignedToProjects ?? crewAllocations.reduce((sum, crew) => sum + Math.max(0, Math.round(crew.plannedHours / 8)), 0);
  const checkedIn = employeeSummary?.activeToday ?? crewAllocations.filter((crew) => crew.availability === "assigned").length;
  const available = employeeSummary?.available ?? crewAllocations.filter((crew) => crew.availability === "available").length;
  const absent = employeeSummary ? Math.max(employeeSummary.totalEmployees - employeeSummary.activeToday - employeeSummary.onLeave, 0) : 0;
  const pto = employeeSummary?.onLeave ?? 0;
  const training = 0;

  return {
    scheduled,
    checkedIn,
    available,
    absent,
    pto,
    training,
    overtimeRisk: crewAllocations.filter((crew) => crew.utilization > 90).length,
    certificationRisk: crewAllocations.filter((crew) => crew.certificationWarnings > 0).length,
    attention: crewAllocations
      .filter((crew) => crew.utilization > 90 || crew.scheduleConflicts > 0 || crew.availability === "unavailable")
      .map((crew) => ({
        employeeId: crew.crewId,
        fullName: crew.crewName,
        type: crew.scheduleConflicts > 0 ? "crew_conflict" : crew.utilization > 90 ? "overtime_risk" : "unassigned",
        reason: crew.scheduleConflicts > 0 ? "Live crew directory shows a conflict." : crew.utilization > 90 ? "Crew utilization is near or above the live capacity threshold." : "Crew is available but not assigned.",
        owner: crew.crewLead || "",
      })),
  };
}

function buildSummary(
  filters: OperationsFilters,
  commandCenterData: OperationsCommandCenterData,
  projects: DailyProjectOperation[],
  crewAllocations: CrewAllocation[],
  employeeSummary: EmployeeDashboardSummary | null,
  workforce: WorkforceStatus,
  schedule: ScheduleEvent[],
  sitecamActivity: SiteCamActivity[],
  priorityQueue: PriorityActionItem[],
): OperationsPayload["summary"] {
  const kpis: OperationsKpi[] = [
    summaryKpi("activeProjects", "Active projects", projects.length, projects.length > 0 ? "Live project data" : "No active projects returned", projects.some((project) => project.riskLevel === "high") ? "operations.kpiTrend.activeProjects" : "operations.kpiTrend.activeProjects", projects.some((project) => project.riskLevel === "high") ? "watch" : "good"),
    summaryKpi("crewsWorking", "Crews working", crewAllocations.filter((crew) => crew.availability === "assigned").length, "Live crew directory", "operations.kpiTrend.crewsWorking", crewAllocations.some((crew) => crew.availability === "assigned") ? "good" : "watch"),
    summaryKpi("crewsAvailable", "Crews available", crewAllocations.filter((crew) => crew.availability === "available").length, "Live crew directory", "operations.kpiTrend.crewsAvailable", crewAllocations.some((crew) => crew.availability === "available") ? "watch" : "neutral"),
    summaryKpi("employeesScheduled", "Employees scheduled", workforce.scheduled, employeeSummary ? "Live employee summary" : "Employee summary unavailable", "operations.kpiTrend.employeesScheduled", workforce.scheduled > 0 ? "good" : "watch"),
    summaryKpi("employeesAvailable", "Employees available", workforce.available, employeeSummary ? "Live employee summary" : "Employee summary unavailable", "operations.kpiTrend.employeesAvailable", workforce.available > 0 ? "neutral" : "watch"),
    summaryKpi("scheduleConflicts", "Schedule conflicts", schedule.filter((item) => item.hasConflict).length, "Live schedule data", "operations.kpiTrend.scheduleConflicts", schedule.some((item) => item.hasConflict) ? "critical" : "good"),
    summaryKpi("safetyAlerts", "Safety alerts", 0, "No live safety alerts source was loaded", "operations.kpiTrend.safetyAlerts", "neutral"),
    summaryKpi("certificationRisks", "Certification risks", workforce.certificationRisk, "Live crew directory", "operations.kpiTrend.certificationRisks", workforce.certificationRisk > 0 ? "watch" : "good"),
    summaryKpi("delayedActivities", "Delayed activities", schedule.filter((item) => item.status === "delayed" || item.status === "at_risk").length, "Live schedule data", "operations.kpiTrend.delayedActivities", schedule.some((item) => item.status === "delayed" || item.status === "at_risk") ? "watch" : "good"),
    summaryKpi("sitecamUpdates", "SiteCam updates", sitecamActivity.length, sitecamActivity.length > 0 ? "Live timeline activity" : "No live SiteCam feed returned", "operations.kpiTrend.sitecamUpdates", sitecamActivity.length > 0 ? "good" : "neutral"),
  ];

  return {
    dateLabel: filters.date,
    dailySummary: `${projects.length} live projects, ${priorityQueue.length} priority actions, ${crewAllocations.length} crew records`,
    companyContext: commandCenterData.companyName,
    locationContext: projects.length > 0 ? `${projects.length} live projects` : "No active projects",
    kpis,
  };
}

function buildSchedulingIntegration(crewAllocations: CrewAllocation[], schedule: ScheduleEvent[], projects: DailyProjectOperation[]) {
  return {
    crewsWorking: crewAllocations.filter((crew) => crew.availability === "assigned").length,
    employeesScheduled: crewAllocations.reduce((sum, crew) => sum + Math.max(0, Math.round(crew.plannedHours / 8)), 0),
    openShifts: crewAllocations.filter((crew) => crew.availability === "available").length,
    scheduleConflicts: schedule.filter((item) => item.hasConflict).length,
    delayedAssignments: projects.filter((project) => project.riskLevel === "high").length,
    overtimeRisk: crewAllocations.filter((crew) => crew.utilization > 90).length,
    understaffedProjects: projects.filter((project) => project.manpowerActual < project.manpowerPlanned).length,
    dispatchDelayed: schedule.filter((item) => item.status === "delayed").length,
  };
}

function summaryKpi(
  id: OperationsKpi["id"],
  label: string,
  value: number | null,
  insight: string,
  trend: string,
  status: OperationsKpi["status"],
): OperationsKpi {
  return {
    id,
    label,
    value: value === null ? "" : String(value),
    insight,
    trend,
    status,
  };
}

function groupByProject<T extends { assignedProject: string | null }>(items: T[], selector: (item: T) => string | null) {
  return items.reduce((map, item) => {
    const key = selector(item);
    if (!key) {
      return map;
    }

    const current = map.get(key) ?? [];
    current.push(item);
    map.set(key, current);
    return map;
  }, new Map<string, T[]>());
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractProjectId(href: string | undefined) {
  if (!href) {
    return "";
  }

  const match = href.match(/\/projects\/([^/?#]+)/);
  return match?.[1] || "";
}

function mapSchedulePeriod(period: OperationsCommandCenterData["schedule"][number]["period"]): ScheduleEvent["period"] {
  if (period === "morning") {
    return "morning";
  }

  if (period === "afternoon") {
    return "afternoon";
  }

  if (period === "evening") {
    return "evening";
  }

  return "midday";
}

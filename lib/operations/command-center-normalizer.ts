import { normalizeChangeOrderStatus } from "@/lib/change-orders/statuses";
import type { BusinessHealthSummaryItem, DashboardActivityItem, DashboardMetric, ExecutiveDashboardData, ScheduleEvent as DashboardScheduleEvent } from "@/lib/dashboard/types";
import { isEquipmentConflict, isEquipmentInUse, isEquipmentMaintenanceDue, isEquipmentOverdueMaintenance } from "@/lib/equipment";
import { normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import { calculateProjectIntelligence } from "@/lib/project-intelligence/calculate-project-intelligence";
import { normalizeProjectStatus } from "@/lib/projects";
import type { DataAvailability, LiveProjectStatusRow, OperationsSummaryMetric, PendingDecisionItem, PriorityActionItem, SectionAvailabilityMap, WorkforceBoardRow } from "./command-center-types";
import { rankPriorityActionItems } from "./command-center-priority";

export type CommandCenterProjectRow = {
  id: string;
  name: string;
  customerId: string | null;
  status: string;
  estimatedEndDate: string | null;
  contractAmount: number | null;
  estimatedCost: number | null;
  description: string | null;
};

export type CommandCenterTaskRow = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  completionPercentage: number;
  plannedStart: string | null;
  plannedFinish: string | null;
  estimatedCompletionDate: string | null;
  assignedProfileId: string | null;
  phaseId: string | null;
  actualHours: number | null;
  estimatedHours: number | null;
};

export type CommandCenterPhaseRow = {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
};

export type CommandCenterPhotoRow = {
  id: string;
  projectId: string;
  capturedAt: string | null;
  createdAt: string;
  uploadedBy: string | null;
};

export type CommandCenterProfileRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

export type CommandCenterCustomerRow = {
  id: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type CommandCenterEstimateRow = {
  id: string;
  projectId: string | null;
  title: string;
  estimateNumber: string | null;
  status: string;
  expirationDate: string | null;
  createdAt: string;
};

export type CommandCenterInvoiceRow = {
  id: string;
  projectId: string | null;
  title: string;
  invoiceNumber: string | null;
  status: string;
  totalAmount: number;
  amountPaid: number;
  dueDate: string | null;
  createdAt: string;
};

export type CommandCenterChangeOrderRow = {
  id: string;
  projectId: string | null;
  title: string;
  changeOrderNumber: string | null;
  status: string;
  requestedDate: string | null;
  createdAt: string;
};

export type CommandCenterEquipmentRow = {
  id: string;
  equipmentNumber: string;
  name: string;
  status: string;
  maintenanceStatus: string;
  assignedJobId: string | null;
  nextServiceDate: string | null;
};

const ACTIVE_PROJECT_STATUSES = new Set(["approved", "scheduled", "in_progress"]);
const ACTIVE_TASK_STATUSES = new Set(["not_started", "in_progress", "blocked"]);
const ESTIMATE_ACTION_STATUSES = new Set(["internal_review", "revision_requested", "sent", "viewed"]);

export function buildAvailabilityMap(input: {
  hasLiveProjects: boolean;
  hasLiveTasks: boolean;
  hasLivePhotos: boolean;
  hasLiveApprovals: boolean;
  hasLiveProfiles: boolean;
  hasRealScheduling: boolean;
  hasRealWorkforce: boolean;
  hasOrionBrief: boolean;
}): SectionAvailabilityMap {
  return {
    header: "live",
    summary: input.hasLiveProjects && input.hasLiveTasks ? "live" : "partial",
    priorityQueue: input.hasLiveTasks || input.hasLiveApprovals ? "live" : "partial",
    projectStatus: input.hasLiveProjects && input.hasLiveTasks ? "live" : "partial",
    workforce: input.hasRealWorkforce && input.hasLiveProfiles ? "live" : "partial",
    schedule: input.hasRealScheduling ? "live" : "partial",
    activityFeed: input.hasLivePhotos ? "live" : "partial",
    pendingDecisions: input.hasLiveApprovals ? "live" : "partial",
    orionBrief: input.hasOrionBrief ? "live" : "partial",
  };
}

export function buildProjectStatusRows(input: {
  projects: CommandCenterProjectRow[];
  customersById: Map<string, CommandCenterCustomerRow>;
  tasksByProject: Map<string, CommandCenterTaskRow[]>;
  phasesById: Map<string, CommandCenterPhaseRow>;
  photosByProject: Map<string, CommandCenterPhotoRow[]>;
  invoicesByProject: Map<string, CommandCenterInvoiceRow[]>;
}): LiveProjectStatusRow[] {
  return input.projects
    .filter((project) => ACTIVE_PROJECT_STATUSES.has(normalizeProjectStatus(project.status).key))
    .map((project) => {
      const tasks = input.tasksByProject.get(project.id) ?? [];
      const photos = input.photosByProject.get(project.id) ?? [];
      const invoices = input.invoicesByProject.get(project.id) ?? [];
      const intelligence = calculateProjectIntelligence({
        project: {
          status: project.status,
          estimated_end_date: project.estimatedEndDate,
          contract_amount: project.contractAmount,
          estimated_cost: project.estimatedCost,
          description: project.description,
        },
        tasks: tasks.map((task) => ({
          id: task.id,
          status: task.status,
          completion_percentage: task.completionPercentage,
          planned_finish: task.plannedFinish,
          assigned_profile_id: task.assignedProfileId,
          phase_id: task.phaseId,
        })),
        invoices: invoices.map((invoice) => ({
          total_amount: invoice.totalAmount,
          amount_paid: invoice.amountPaid,
          due_date: invoice.dueDate,
        })),
        counts: { estimates: 0, changeOrders: 0, photos: photos.length },
      });

      const overdueTaskCount = tasks.filter((task) => isOverdueTask(task)).length;
      const blockedTaskCount = tasks.filter((task) => normalizeTaskStatus(task.status) === "blocked").length;
      const assignedWorkerCount = new Set(tasks.map((task) => task.assignedProfileId).filter((value): value is string => Boolean(value))).size;
      const currentPhase = deriveCurrentPhase(tasks, input.phasesById);
      const latestActivityAt = photos
        .map((photo) => photo.capturedAt || photo.createdAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => right.localeCompare(left))[0] ?? null;
      const nextMilestoneTask = tasks
        .filter((task) => Boolean(task.plannedFinish) && normalizeTaskStatus(task.status) !== "completed")
        .sort((left, right) => compareNullableIso(left.plannedFinish, right.plannedFinish))[0] ?? null;

      return {
        id: project.id,
        projectName: project.name,
        customerName: formatCustomerName(input.customersById.get(project.customerId || "")) || "Unlinked customer",
        healthScore: intelligence.summary.healthScore ?? 0,
        progressPercent: intelligence.summary.completionPercent,
        riskLevel: toRiskLevel(blockedTaskCount, overdueTaskCount),
        currentPhase,
        overdueTaskCount,
        blockedTaskCount,
        assignedWorkerCount,
        latestActivityAt,
        nextMilestone: nextMilestoneTask ? `${nextMilestoneTask.title} · ${nextMilestoneTask.plannedFinish}` : project.estimatedEndDate,
        scheduleVarianceLabel: null,
        href: `/projects/${project.id}`,
      };
    })
    .sort((left, right) => right.healthScore - left.healthScore)
    .sort((left, right) => riskWeight(right.riskLevel) - riskWeight(left.riskLevel) || left.projectName.localeCompare(right.projectName));
}

export function buildSummaryMetrics(input: {
  projects: LiveProjectStatusRow[];
  tasks: CommandCenterTaskRow[];
  schedule: DashboardScheduleEvent[];
  photos: CommandCenterPhotoRow[];
  changeOrders: CommandCenterChangeOrderRow[];
  workforceRows: WorkforceBoardRow[];
  equipment: CommandCenterEquipmentRow[];
  todayIso: string;
  alertCount: number;
  workforceAvailability: DataAvailability;
  scheduleAvailability: DataAvailability;
}): OperationsSummaryMetric[] {
  const tasksDueToday = input.tasks.filter((task) => resolveTaskDate(task) === input.todayIso).length;
  const overdueTasks = input.tasks.filter((task) => isOverdueTask(task)).length;
  const assignedWorkforce = input.workforceRows.filter((row) => row.status !== "unassigned").length;
  const unassignedWork = input.tasks.filter((task) => ACTIVE_TASK_STATUSES.has(normalizeTaskStatus(task.status)) && !task.assignedProfileId).length;
  const newSitecamActivity = input.photos.filter((photo) => (photo.capturedAt || photo.createdAt).slice(0, 10) === input.todayIso).length;
  const pendingApprovals = input.changeOrders.filter((row) => normalizeChangeOrderStatus(row.status) === "pending_approval").length;
  const equipmentInUse = input.equipment.filter(isEquipmentInUse).length;
  const equipmentMaintenanceDue = input.equipment.filter(isEquipmentMaintenanceDue).length;
  const equipmentConflicts = input.equipment.filter(isEquipmentConflict).length;

  return [
    metric("activeProjects", "Active projects", input.projects.length, "/projects", input.projects.some((project) => project.riskLevel === "high") ? "warning" : "success"),
    metric("projectsAtRisk", "Projects at risk", input.projects.filter((project) => project.riskLevel !== "low").length, "/projects", input.projects.some((project) => project.riskLevel === "high") ? "danger" : "warning"),
    metric("tasksDueToday", "Tasks due today", tasksDueToday, "/projects", tasksDueToday > 0 ? "warning" : "default"),
    metric("overdueTasks", "Overdue tasks", overdueTasks, "/projects", overdueTasks > 0 ? "danger" : "default"),
    {
      ...metric("assignedWorkforce", "Assigned workforce", assignedWorkforce, "/team", assignedWorkforce > 0 ? "success" : "muted"),
      availability: input.workforceAvailability,
      description: input.workforceAvailability === "partial" ? "Real crew assignment services are not available yet; showing profile task assignments." : undefined,
    },
    {
      ...metric("unassignedWork", "Unassigned work", unassignedWork, "/projects", unassignedWork > 0 ? "warning" : "default"),
      availability: input.workforceAvailability,
    },
    {
      ...metric("scheduleEventsToday", "Schedule events today", input.schedule.length, "/schedule", input.schedule.length > 0 ? "default" : "muted"),
      availability: input.scheduleAvailability,
      description: input.scheduleAvailability === "partial" ? "Derived from live task dates because the scheduling service is still mock-backed." : undefined,
    },
    metric("pendingApprovals", "Pending approvals", pendingApprovals, "/change-orders", pendingApprovals > 0 ? "warning" : "default"),
    metric("newSitecamActivity", "New SiteCam activity", newSitecamActivity, "/projects", newSitecamActivity > 0 ? "success" : "default"),
    metric("operationalAlerts", "Operational alerts", input.alertCount, "/operations", input.alertCount > 0 ? "danger" : "default"),
    metric("equipmentInUse", "Equipment in use", equipmentInUse, "/equipment", equipmentInUse > 0 ? "success" : "default"),
    metric("equipmentMaintenanceDue", "Equipment maintenance due", equipmentMaintenanceDue, "/equipment", equipmentMaintenanceDue > 0 ? "warning" : "default"),
    metric("equipmentConflicts", "Equipment conflicts", equipmentConflicts, "/equipment", equipmentConflicts > 0 ? "danger" : "default"),
  ];
}

export function buildPriorityQueue(input: {
  projects: LiveProjectStatusRow[];
  tasks: CommandCenterTaskRow[];
  projectNameById: Map<string, string>;
  profileNameById: Map<string, string>;
  changeOrders: CommandCenterChangeOrderRow[];
  estimates: CommandCenterEstimateRow[];
  invoices: CommandCenterInvoiceRow[];
}): PriorityActionItem[] {
  const items: Omit<PriorityActionItem, "rank">[] = [];

  for (const task of input.tasks) {
    const normalized = normalizeTaskStatus(task.status);
    const projectName = input.projectNameById.get(task.projectId) || null;
    const owner = task.assignedProfileId ? input.profileNameById.get(task.assignedProfileId) || null : null;

    if (normalized === "blocked") {
      items.push({
        id: `blocked-${task.id}`,
        title: task.title,
        sourceModule: "Tasks",
        severity: isOverdueTask(task) ? "critical" : "high",
        projectName,
        owner,
        dueAt: task.plannedFinish,
        ageHours: ageHours(task.plannedFinish),
        recommendedAction: owner ? "Resolve the blocker or reassign the task owner." : "Assign an owner and remove the blocker.",
        href: `/projects/${task.projectId}`,
        focus: owner ? "projects" : "workforce",
      });
    }

    if (isOverdueTask(task)) {
      items.push({
        id: `overdue-${task.id}`,
        title: task.title,
        sourceModule: "Tasks",
        severity: owner ? "high" : "critical",
        projectName,
        owner,
        dueAt: task.plannedFinish,
        ageHours: ageHours(task.plannedFinish),
        recommendedAction: owner ? "Review the overdue task and confirm recovery plan." : "Assign the overdue task before the next field shift.",
        href: `/projects/${task.projectId}`,
        focus: owner ? "today" : "workforce",
      });
    }

    if (ACTIVE_TASK_STATUSES.has(normalized) && !task.assignedProfileId) {
      items.push({
        id: `unassigned-${task.id}`,
        title: task.title,
        sourceModule: "Workforce",
        severity: task.plannedFinish === todayIso() ? "high" : "medium",
        projectName,
        owner: null,
        dueAt: task.plannedFinish,
        ageHours: ageHours(task.plannedFinish),
        recommendedAction: "Assign a field owner before work proceeds.",
        href: `/projects/${task.projectId}`,
        focus: "workforce",
      });
    }
  }

  for (const project of input.projects.filter((project) => project.riskLevel !== "low")) {
    items.push({
      id: `project-risk-${project.id}`,
      title: project.projectName,
      sourceModule: "Projects",
      severity: project.riskLevel === "high" ? "critical" : "high",
      projectName: project.projectName,
      owner: null,
      dueAt: null,
      ageHours: null,
      recommendedAction: "Review overdue or blocked work and confirm the next milestone plan.",
      href: project.href,
      focus: "projects",
    });
  }

  for (const changeOrder of input.changeOrders.filter((row) => normalizeChangeOrderStatus(row.status) === "pending_approval")) {
    items.push({
      id: `change-order-${changeOrder.id}`,
      title: changeOrder.changeOrderNumber ? `${changeOrder.changeOrderNumber} · ${changeOrder.title}` : changeOrder.title,
      sourceModule: "Approvals",
      severity: "high",
      projectName: changeOrder.projectId ? input.projectNameById.get(changeOrder.projectId) || null : null,
      owner: null,
      dueAt: changeOrder.requestedDate,
      ageHours: ageHours(changeOrder.createdAt),
      recommendedAction: "Open the change order detail and review approval status.",
      href: `/change-orders/${changeOrder.id}`,
      focus: "approvals",
    });
  }

  for (const estimate of input.estimates.filter((row) => ESTIMATE_ACTION_STATUSES.has(row.status.trim().toLowerCase()))) {
    items.push({
      id: `estimate-${estimate.id}`,
      title: estimate.estimateNumber ? `${estimate.estimateNumber} · ${estimate.title}` : estimate.title,
      sourceModule: "Estimates",
      severity: estimate.expirationDate && estimate.expirationDate <= todayIso() ? "high" : "medium",
      projectName: estimate.projectId ? input.projectNameById.get(estimate.projectId) || null : null,
      owner: null,
      dueAt: estimate.expirationDate,
      ageHours: ageHours(estimate.createdAt),
      recommendedAction: "Review the estimate status and confirm the next customer step.",
      href: estimate.projectId ? `/projects/${estimate.projectId}` : "/estimates",
      focus: "approvals",
    });
  }

  for (const invoice of input.invoices.filter((row) => invoiceNeedsAttention(row))) {
    items.push({
      id: `invoice-${invoice.id}`,
      title: invoice.invoiceNumber ? `${invoice.invoiceNumber} · ${invoice.title}` : invoice.title,
      sourceModule: "Invoices",
      severity: invoice.dueDate && invoice.dueDate < todayIso() ? "critical" : "medium",
      projectName: invoice.projectId ? input.projectNameById.get(invoice.projectId) || null : null,
      owner: null,
      dueAt: invoice.dueDate,
      ageHours: ageHours(invoice.createdAt),
      recommendedAction: "Review the invoice and confirm collection or send status.",
      href: `/invoices/${invoice.id}`,
      focus: "approvals",
    });
  }

  return rankPriorityActionItems(items).slice(0, 18);
}

export function buildWorkforceBoard(input: {
  tasks: CommandCenterTaskRow[];
  projectNameById: Map<string, string>;
  phasesById: Map<string, CommandCenterPhaseRow>;
  profilesById: Map<string, CommandCenterProfileRow>;
}): WorkforceBoardRow[] {
  const taskBuckets = new Map<string, CommandCenterTaskRow[]>();

  for (const task of input.tasks) {
    if (!task.assignedProfileId || !ACTIVE_TASK_STATUSES.has(normalizeTaskStatus(task.status))) {
      continue;
    }

    const bucket = taskBuckets.get(task.assignedProfileId) ?? [];
    bucket.push(task);
    taskBuckets.set(task.assignedProfileId, bucket);
  }

  return Array.from(taskBuckets.entries())
    .map(([profileId, tasks]) => {
      const profile = input.profilesById.get(profileId);
      const primaryTask = tasks.slice().sort((left, right) => taskOrder(left.status) - taskOrder(right.status))[0];
      const assignedProject = primaryTask ? input.projectNameById.get(primaryTask.projectId) || null : null;
      const scheduledHours = tasks.reduce((sum, task) => sum + Math.max(0, task.estimatedHours || 0), 0) || null;
      const timeLoggedHours = tasks.reduce((sum, task) => sum + Math.max(0, task.actualHours || 0), 0) || null;
      const hasConflict = tasks.length > 1;
      const status: WorkforceBoardRow["status"] = tasks.length >= 3 ? "overloaded" : "assigned";

      return {
        profileId,
        fullName: formatProfileName(profile),
        assignedProject,
        currentTask: primaryTask?.title || null,
        currentPhase: primaryTask?.phaseId ? input.phasesById.get(primaryTask.phaseId)?.name || null : null,
        scheduledHours,
        timeLoggedHours,
        taskCount: tasks.length,
        status,
        hasConflict,
        href: assignedProject ? `/projects/${primaryTask.projectId}` : "/team",
      };
    })
    .sort((left, right) => workloadWeight(right.status) - workloadWeight(left.status) || right.taskCount - left.taskCount || left.fullName.localeCompare(right.fullName));
}

export function buildTodaySchedule(tasks: CommandCenterTaskRow[], projectNameById: Map<string, string>, filterDate: string): DashboardScheduleEvent[] {
  return tasks
    .filter((task) => {
      const date = resolveTaskDate(task);
      return date === filterDate;
    })
    .map((task) => ({
      id: `task-${task.id}`,
      period: derivePeriod(task.plannedStart),
      timeLabel: deriveTimeLabel(task.plannedStart),
      titleKey: null,
      title: task.title,
      projectName: projectNameById.get(task.projectId) || "Project",
      location: "",
      employeesAssigned: task.assignedProfileId ? 1 : 0,
      status: toScheduleStatus(task.status),
      href: `/projects/${task.projectId}`,
      occurredAt: task.plannedStart || task.plannedFinish || task.estimatedCompletionDate,
    }))
    .sort((left, right) => compareNullableIso(left.occurredAt || null, right.occurredAt || null));
}

export function buildActivityFeed(input: {
  photos: CommandCenterPhotoRow[];
  invoices: CommandCenterInvoiceRow[];
  changeOrders: CommandCenterChangeOrderRow[];
  profileNameById: Map<string, string>;
  projectNameById: Map<string, string>;
}): DashboardActivityItem[] {
  const items: DashboardActivityItem[] = [];

  for (const photo of input.photos.slice(0, 24)) {
    const user = photo.uploadedBy ? input.profileNameById.get(photo.uploadedBy) || "Team member" : "Team member";
    items.push({
      id: `photo-${photo.id}`,
      icon: "SC",
      category: "sitecam",
      timestampMinutesAgo: diffMinutes(photo.capturedAt || photo.createdAt),
      user,
      avatarLabel: initials(user),
      actionLabelKey: "dashboard.activityPhotoUploaded",
      actionLabel: null,
      projectName: input.projectNameById.get(photo.projectId),
      href: `/projects/${photo.projectId}`,
    });
  }

  for (const invoice of input.invoices.slice(0, 16)) {
    items.push({
      id: `invoice-${invoice.id}`,
      icon: "I",
      category: "invoice",
      timestampMinutesAgo: diffMinutes(invoice.createdAt),
      user: "System",
      avatarLabel: "SY",
      actionLabelKey: "dashboard.activityInvoiceSent",
      actionLabel: null,
      projectName: invoice.projectId ? input.projectNameById.get(invoice.projectId) : undefined,
      href: invoice.projectId ? `/projects/${invoice.projectId}` : "/invoices",
    });
  }

  for (const changeOrder of input.changeOrders.slice(0, 16)) {
    items.push({
      id: `change-order-${changeOrder.id}`,
      icon: "CO",
      category: "project",
      timestampMinutesAgo: diffMinutes(changeOrder.createdAt),
      user: "System",
      avatarLabel: "SY",
      actionLabelKey: null,
      actionLabel: changeOrder.title,
      projectName: changeOrder.projectId ? input.projectNameById.get(changeOrder.projectId) : undefined,
      href: changeOrder.projectId ? `/projects/${changeOrder.projectId}` : "/change-orders",
    });
  }

  return items
    .filter((item) => Number.isFinite(item.timestampMinutesAgo))
    .sort((left, right) => left.timestampMinutesAgo - right.timestampMinutesAgo)
    .slice(0, 18);
}

export function buildPendingDecisions(input: {
  tasks: CommandCenterTaskRow[];
  projectNameById: Map<string, string>;
  profileNameById: Map<string, string>;
  changeOrders: CommandCenterChangeOrderRow[];
  estimates: CommandCenterEstimateRow[];
  invoices: CommandCenterInvoiceRow[];
  equipment: CommandCenterEquipmentRow[];
}): PendingDecisionItem[] {
  const items: PendingDecisionItem[] = [];

  for (const changeOrder of input.changeOrders.filter((row) => normalizeChangeOrderStatus(row.status) === "pending_approval").slice(0, 6)) {
    items.push({
      id: `change-order-${changeOrder.id}`,
      title: changeOrder.changeOrderNumber ? `${changeOrder.changeOrderNumber} · ${changeOrder.title}` : changeOrder.title,
      decisionType: "change_order",
      severity: "high",
      projectName: changeOrder.projectId ? input.projectNameById.get(changeOrder.projectId) || null : null,
      owner: null,
      dueAt: changeOrder.requestedDate,
      href: `/change-orders/${changeOrder.id}`,
    });
  }

  for (const estimate of input.estimates.filter((row) => ESTIMATE_ACTION_STATUSES.has(row.status.trim().toLowerCase())).slice(0, 4)) {
    items.push({
      id: `estimate-${estimate.id}`,
      title: estimate.estimateNumber ? `${estimate.estimateNumber} · ${estimate.title}` : estimate.title,
      decisionType: "estimate",
      severity: estimate.expirationDate && estimate.expirationDate <= todayIso() ? "high" : "medium",
      projectName: estimate.projectId ? input.projectNameById.get(estimate.projectId) || null : null,
      owner: null,
      dueAt: estimate.expirationDate,
      href: estimate.projectId ? `/projects/${estimate.projectId}` : "/estimates",
    });
  }

  for (const invoice of input.invoices.filter((row) => invoiceNeedsAttention(row)).slice(0, 4)) {
    items.push({
      id: `invoice-${invoice.id}`,
      title: invoice.invoiceNumber ? `${invoice.invoiceNumber} · ${invoice.title}` : invoice.title,
      decisionType: "invoice",
      severity: invoice.dueDate && invoice.dueDate < todayIso() ? "critical" : "medium",
      projectName: invoice.projectId ? input.projectNameById.get(invoice.projectId) || null : null,
      owner: null,
      dueAt: invoice.dueDate,
      href: `/invoices/${invoice.id}`,
    });
  }

  for (const task of input.tasks.filter((row) => normalizeTaskStatus(row.status) === "blocked" || (ACTIVE_TASK_STATUSES.has(normalizeTaskStatus(row.status)) && !row.assignedProfileId)).slice(0, 6)) {
    items.push({
      id: `task-${task.id}`,
      title: task.title,
      decisionType: "task",
      severity: normalizeTaskStatus(task.status) === "blocked" ? "high" : "medium",
      projectName: input.projectNameById.get(task.projectId) || null,
      owner: task.assignedProfileId ? input.profileNameById.get(task.assignedProfileId) || null : null,
      dueAt: task.plannedFinish,
      href: `/projects/${task.projectId}`,
    });
  }

  for (const equipment of input.equipment) {
    if (!isEquipmentConflict(equipment)) {
      continue;
    }

    items.push({
      id: `equipment-${equipment.id}`,
      title: `${equipment.equipmentNumber} · ${equipment.name}`,
      decisionType: "equipment",
      severity: isEquipmentOverdueMaintenance(equipment) ? "critical" : "high",
      projectName: equipment.assignedJobId ? input.projectNameById.get(equipment.assignedJobId) || null : null,
      owner: null,
      dueAt: equipment.nextServiceDate,
      href: `/equipment/${equipment.id}`,
    });
  }

  return items.sort((left, right) => riskWeight(right.severity) - riskWeight(left.severity) || compareNullableIso(left.dueAt, right.dueAt) || left.title.localeCompare(right.title)).slice(0, 12);
}

export function buildDashboardLikeData(input: {
  summaryMetrics: OperationsSummaryMetric[];
  projects: LiveProjectStatusRow[];
  schedule: DashboardScheduleEvent[];
  activityFeed: DashboardActivityItem[];
  priorityQueue: PriorityActionItem[];
  availability: SectionAvailabilityMap;
}): ExecutiveDashboardData {
  const healthScoreMetric = Math.round(
    input.projects.length === 0
      ? 0
      : input.projects.reduce((sum, project) => sum + project.healthScore, 0) / input.projects.length,
  );

  const metrics: DashboardMetric[] = [
    metricToDashboard(input.summaryMetrics.find((item) => item.id === "activeProjects"), "active-projects", "dashboard.metricActiveProjects", "P", "/projects"),
    metricToDashboard(input.summaryMetrics.find((item) => item.id === "assignedWorkforce"), "assigned-active-work", "dashboard.metricAssignedActiveWork", "A", "/team"),
    {
      id: "open-estimates",
      icon: "S",
      titleKey: "dashboard.metricOpenEstimates",
      value: 0,
      valueKind: "number" as const,
      href: "/estimates",
      tooltipKey: "dashboard.metricOpenEstimatesTooltip",
      displayValueKey: undefined,
    },
    {
      id: "open-invoices",
      icon: "I",
      titleKey: "dashboard.metricOpenInvoices",
      value: 0,
      valueKind: "number" as const,
      href: "/invoices",
      tooltipKey: "dashboard.metricOpenInvoicesTooltip",
      displayValueKey: undefined,
    },
    {
      id: "revenue-this-month",
      icon: "$",
      titleKey: "dashboard.metricRevenueThisMonth",
      value: 0,
      valueKind: "currency" as const,
      href: "/invoices",
      tooltipKey: "dashboard.metricRevenueThisMonthTooltip",
      displayValueKey: input.availability.pendingDecisions === "unavailable" ? "dashboard.metricRestrictedValue" : undefined,
    },
    {
      id: "health-score",
      icon: "AI",
      titleKey: "dashboard.metricHealthScore",
      value: healthScoreMetric,
      valueKind: "score" as const,
      href: "/operations",
      tooltipKey: "dashboard.metricHealthScoreTooltip",
      displayValueKey: undefined,
    },
  ];

  const projectHealth: ExecutiveDashboardData["projectHealth"] = {
    onScheduleCount: input.projects.filter((project) => project.riskLevel === "low").length,
    atRiskCount: input.projects.filter((project) => project.riskLevel === "medium").length,
    behindScheduleCount: input.projects.filter((project) => project.riskLevel === "high").length,
    projects: input.projects.slice(0, 5).map((project) => ({
      id: project.id,
      projectName: project.projectName,
      healthScore: project.healthScore,
      budgetStatusKey: "dashboard.projectBudgetWatch",
      scheduleStatusKey: project.riskLevel === "high" ? "dashboard.projectScheduleAtRisk" : project.riskLevel === "medium" ? "dashboard.projectScheduleSlightDelay" : "dashboard.projectScheduleOnTrack",
      lastPhotoUpload: project.latestActivityAt ? relativeTime(project.latestActivityAt) : "--",
      lastDailyReport: "--",
      currentPhase: project.currentPhase,
      riskIndicator: project.riskLevel,
      href: project.href,
    })),
  };

  const recommendations: ExecutiveDashboardData["recommendations"] = input.priorityQueue.slice(0, 4).map((item) => ({
    id: item.id,
    icon: item.sourceModule === "Approvals" ? "CO" : item.sourceModule === "Invoices" ? "I" : "P",
    priority: item.severity,
    timestampMinutesAgo: Math.max(0, Math.round((item.ageHours || 0) * 60)),
    messageKey: "dashboard.recommendationBlockedTasks",
    actions: [
      { id: `${item.id}-open`, labelKey: "dashboard.actionReviewProject", intent: "primary" as const },
    ],
  }));

  const businessSummaryItems: BusinessHealthSummaryItem[] = [
    { id: "projects", labelKey: "dashboard.businessScoreProjects", state: projectHealth.behindScheduleCount > 0 ? "attention" : "healthy", detailsKey: "dashboard.businessSummaryProjectsDetails" },
    { id: "financial", labelKey: "dashboard.businessScoreFinancial", state: "restricted", detailsKey: "dashboard.businessSummaryFinancialDetails" },
    { id: "scheduling", labelKey: "dashboard.businessScoreScheduling", state: input.availability.schedule === "partial" ? "attention" : "healthy", detailsKey: "dashboard.businessSummarySchedulingDetails" },
    { id: "documentation", labelKey: "dashboard.businessScoreDocumentation", state: input.availability.activityFeed === "live" ? "healthy" : "attention", detailsKey: "dashboard.businessSummaryDocumentationDetails" },
    { id: "safety", labelKey: "dashboard.businessScoreSafety", state: "unavailable", detailsKey: "dashboard.businessSummarySafetyDetails" },
  ];

  return {
    metrics,
    activities: input.activityFeed,
    projectHealth,
    schedule: input.schedule,
    weather: null,
    businessScore: null,
    businessSummary: {
      items: businessSummaryItems,
    },
    recommendations,
    pendingFollowups: [],
    automationQueue: [],
    recentAutomations: [],
    estimatePipeline: {
      total: 0,
      draft: 0,
      sent: 0,
      viewed: 0,
      revisionRequested: 0,
      approved: 0,
      rejected: 0,
    },
    topPriorities: [],
    businessHealth: [],
    riskSummary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    decisionRecommendations: [],
    todaysDecisions: [],
    criticalAlerts: [],
    morningBriefing: {
      greeting: "",
      lines: [],
    },
    widgetDefinitions: [],
  };
}

function metric(id: OperationsSummaryMetric["id"], label: string, value: number | null, href: string, tone: OperationsSummaryMetric["tone"]): OperationsSummaryMetric {
  return {
    id,
    label,
    value,
    availability: value === null ? "unavailable" : "live",
    href,
    tone,
  };
}

function metricToDashboard(metric: OperationsSummaryMetric | undefined, id: string, titleKey: string, icon: string, href: string) {
  return {
    id,
    icon,
    titleKey,
    value: metric?.value ?? 0,
    valueKind: "number" as const,
    href,
    tooltipKey: titleKey,
    displayValueKey: metric?.availability === "unavailable" ? "dashboard.metricRestrictedValue" : undefined,
  };
}

function normalizeTaskStatus(status: string) {
  return status.trim().toLowerCase();
}

function isOverdueTask(task: CommandCenterTaskRow) {
  return task.plannedFinish !== null && task.plannedFinish < todayIso() && normalizeTaskStatus(task.status) !== "completed";
}

function deriveCurrentPhase(tasks: CommandCenterTaskRow[], phasesById: Map<string, CommandCenterPhaseRow>) {
  const active = tasks
    .filter((task) => Boolean(task.phaseId))
    .sort((left, right) => taskOrder(left.status) - taskOrder(right.status))[0];

  if (!active?.phaseId) {
    return "No active phase";
  }

  return phasesById.get(active.phaseId)?.name || "No active phase";
}

function taskOrder(status: string) {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "blocked") {
    return 0;
  }
  if (normalized === "in_progress") {
    return 1;
  }
  if (normalized === "not_started") {
    return 2;
  }
  return 3;
}

function workloadWeight(status: WorkforceBoardRow["status"]) {
  if (status === "overloaded") {
    return 3;
  }
  if (status === "assigned") {
    return 2;
  }
  return 1;
}

function derivePeriod(value: string | null): DashboardScheduleEvent["period"] {
  if (!value || !value.includes("T")) {
    return "time_unavailable";
  }

  const hours = new Date(value).getHours();
  if (hours < 12) {
    return "morning";
  }
  if (hours < 17) {
    return "afternoon";
  }
  return "evening";
}

function deriveTimeLabel(value: string | null) {
  if (!value || !value.includes("T")) {
    return "__time_unavailable__";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toScheduleStatus(status: string): DashboardScheduleEvent["status"] {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "completed") {
    return "complete";
  }
  if (normalized === "in_progress") {
    return "confirmed";
  }
  if (normalized === "blocked") {
    return "pending";
  }
  return "pending";
}

function resolveTaskDate(task: CommandCenterTaskRow) {
  return (task.plannedStart || task.plannedFinish || task.estimatedCompletionDate || "").slice(0, 10);
}

function compareNullableIso(left: string | null, right: string | null) {
  const leftValue = left ? new Date(left).getTime() : Number.MAX_SAFE_INTEGER;
  const rightValue = right ? new Date(right).getTime() : Number.MAX_SAFE_INTEGER;
  return leftValue - rightValue;
}

function formatCustomerName(customer: CommandCenterCustomerRow | undefined) {
  if (!customer) {
    return null;
  }

  if (customer.companyName?.trim()) {
    return customer.companyName.trim();
  }

  return [customer.firstName?.trim() || "", customer.lastName?.trim() || ""].filter(Boolean).join(" ") || null;
}

function formatProfileName(profile: CommandCenterProfileRow | undefined) {
  if (!profile) {
    return "Team member";
  }

  return [profile.firstName?.trim() || "", profile.lastName?.trim() || ""].filter(Boolean).join(" ") || "Team member";
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "TM";
}

function diffMinutes(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.round((Date.now() - time) / 60000));
}

function ageHours(value: string | null) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  return Math.max(0, Math.round((Date.now() - time) / 3600000));
}

function riskWeight(level: "low" | "medium" | "high" | "critical") {
  if (level === "critical") {
    return 4;
  }
  if (level === "high") {
    return 3;
  }
  if (level === "medium") {
    return 2;
  }
  return 1;
}

function toRiskLevel(blockedTasks: number, overdueTasks: number): "low" | "medium" | "high" {
  if (blockedTasks >= 2 || overdueTasks >= 3) {
    return "high";
  }
  if (blockedTasks >= 1 || overdueTasks >= 1) {
    return "medium";
  }
  return "low";
}

function invoiceNeedsAttention(invoice: CommandCenterInvoiceRow) {
  const normalizedStatus = normalizeInvoiceStatus(invoice.status);
  const balance = Math.max(0, invoice.totalAmount - invoice.amountPaid);
  return normalizedStatus === "overdue" || (normalizedStatus === "draft" && balance > 0) || (normalizedStatus === "sent" && balance > 0);
}

function relativeTime(value: string) {
  const minutes = diffMinutes(value);
  if (!Number.isFinite(minutes)) {
    return "--";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
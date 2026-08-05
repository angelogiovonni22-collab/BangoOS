import type { SupabaseClient } from "@supabase/supabase-js";
import { buildExecutiveBrief } from "@/lib/orion/executive-brief-service";
import { createOrionTimelineService } from "@/lib/orion/timeline";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import type { OperationsCommandCenterResult } from "./command-center-types";
import {
  buildAvailabilityMap,
  buildDashboardLikeData,
  buildPendingDecisions,
  buildPriorityQueue,
  buildProjectStatusRows,
  buildSummaryMetrics,
  buildTodaySchedule,
  buildWorkforceBoard,
  type CommandCenterChangeOrderRow,
  type CommandCenterEquipmentRow,
  type CommandCenterCustomerRow,
  type CommandCenterEstimateRow,
  type CommandCenterInvoiceRow,
  type CommandCenterPhaseRow,
  type CommandCenterPhotoRow,
  type CommandCenterProfileRow,
  type CommandCenterProjectRow,
  type CommandCenterTaskRow,
} from "./command-center-normalizer";

export async function getOperationsCommandCenter(
  supabase: SupabaseClient<Database>,
  workspace: WorkspaceContext,
  localeTag: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): Promise<OperationsCommandCenterResult> {
  const [projects, customers, tasks, phases, photos, profiles, estimates, invoices, changeOrders, equipment] = await Promise.all([
    loadProjects(supabase, workspace.companyId),
    loadCustomers(supabase, workspace.companyId),
    loadTasks(supabase, workspace.companyId),
    loadProjectPhases(supabase, workspace.companyId),
    loadProjectPhotos(supabase, workspace.companyId),
    loadProfiles(supabase, workspace.companyId),
    loadEstimates(supabase, workspace.companyId),
    loadInvoices(supabase, workspace.companyId),
    loadChangeOrders(supabase, workspace.companyId),
    loadEquipment(supabase, workspace.companyId),
  ]);

  const customersById = new Map(customers.map((row) => [row.id, row]));
  const phasesById = new Map(phases.map((row) => [row.id, row]));
  const profilesById = new Map(profiles.map((row) => [row.id, row]));
  const profileNameById = new Map(profiles.map((row) => [row.id, [row.firstName?.trim() || "", row.lastName?.trim() || ""].filter(Boolean).join(" ") || "Team member"]));
  const projectNameById = new Map(projects.map((row) => [row.id, row.name]));
  const tasksByProject = groupBy(tasks, (task) => task.projectId);
  const photosByProject = groupBy(photos, (photo) => photo.projectId);
  const invoicesByProject = groupBy(invoices.filter((row) => row.projectId), (row) => row.projectId as string);

  const projectStatus = buildProjectStatusRows({
    projects,
    customersById,
    tasksByProject,
    phasesById,
    photosByProject,
    invoicesByProject,
  });

  const workforceBoard = buildWorkforceBoard({
    tasks,
    projectNameById,
    phasesById,
    profilesById,
  });

  const schedule = buildTodaySchedule(tasks, projectNameById, new Date().toISOString().slice(0, 10));
  const activityFeed = await buildTimelineActivityFeed({
    supabase,
    companyId: workspace.companyId,
    projectNameById,
  });
  const priorityQueue = buildPriorityQueue({
    projects: projectStatus,
    tasks,
    projectNameById,
    profileNameById,
    changeOrders,
    estimates,
    invoices,
  });
  const pendingDecisions = buildPendingDecisions({
    tasks,
    projectNameById,
    profileNameById,
    changeOrders,
    estimates,
    invoices,
    equipment,
  });
  const availability = buildAvailabilityMap({
    hasLiveProjects: projects.length > 0,
    hasLiveTasks: tasks.length > 0,
    hasLivePhotos: photos.length > 0,
    hasLiveApprovals: changeOrders.length > 0 || estimates.length > 0 || invoices.length > 0,
    hasLiveProfiles: profiles.length > 0,
    hasRealScheduling: false,
    hasRealWorkforce: false,
    hasOrionBrief: true,
  });
  const summaryMetrics = buildSummaryMetrics({
    projects: projectStatus,
    tasks,
    schedule,
    photos,
    changeOrders,
    workforceRows: workforceBoard,
    equipment,
    todayIso: new Date().toISOString().slice(0, 10),
    alertCount: priorityQueue.filter((item) => item.severity === "critical" || item.severity === "high").length,
    workforceAvailability: availability.workforce,
    scheduleAvailability: availability.schedule,
  });

  const dashboardData = buildDashboardLikeData({
    summaryMetrics,
    projects: projectStatus,
    schedule,
    activityFeed,
    priorityQueue,
    availability,
  });

  const orionBrief = await buildExecutiveBrief({
    supabase,
    companyId: workspace.companyId,
    companyName: workspace.companyName,
    companyRole: workspace.role,
    dashboardData,
    dashboardSectionErrors: {},
    localeTag,
    t,
  });

  return {
    permissionError: false,
    data: {
      companyName: workspace.companyName || "BangoOS",
      currentDateIso: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
      operatingStatus: priorityQueue.some((item) => item.severity === "critical")
        ? { label: "Critical attention required", tone: "danger" }
        : priorityQueue.some((item) => item.severity === "high")
          ? { label: "Attention needed", tone: "warning" }
          : { label: "Operating within expected range", tone: "success" },
      healthIndicator: {
        score: Math.round(projectStatus.reduce((sum, project) => sum + project.healthScore, 0) / Math.max(projectStatus.length, 1)),
        label: projectStatus.some((project) => project.riskLevel === "high") ? "Watch" : "Healthy",
      },
      summaryMetrics,
      priorityQueue,
      projectStatus,
      workforceBoard,
      schedule,
      activityFeed,
      pendingDecisions,
      orionBrief,
      projectOptions: projects.map((project) => ({ id: project.id, label: project.name })),
      availability,
      partialNotices: [
        availability.workforce === "partial" ? "Workforce assignments use live task owners because crew scheduling and time-entry services are not live yet." : "",
        availability.schedule === "partial" ? "Today's schedule is derived from live task dates because the shared scheduling service is still mock-backed." : "",
      ].filter(Boolean),
    },
  };
}

async function loadProjects(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, customer_id, status, estimated_end_date, contract_amount, estimated_cost, description")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    customerId: row.customer_id,
    status: row.status,
    estimatedEndDate: row.estimated_end_date,
    contractAmount: row.contract_amount,
    estimatedCost: row.estimated_cost,
    description: row.description,
  })) as CommandCenterProjectRow[];
}

async function loadCustomers(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("id, company_name, first_name, last_name")
    .eq("company_id", companyId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    companyName: row.company_name,
    firstName: row.first_name,
    lastName: row.last_name,
  })) as CommandCenterCustomerRow[];
}

async function loadTasks(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, project_id, title, status, completion_percentage, planned_start, planned_finish, estimated_completion_date, assigned_profile_id, phase_id, actual_hours, estimated_hours")
    .eq("company_id", companyId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    completionPercentage: row.completion_percentage,
    plannedStart: row.planned_start,
    plannedFinish: row.planned_finish,
    estimatedCompletionDate: row.estimated_completion_date,
    assignedProfileId: row.assigned_profile_id,
    phaseId: row.phase_id,
    actualHours: row.actual_hours,
    estimatedHours: row.estimated_hours,
  })) as CommandCenterTaskRow[];
}

async function loadProjectPhases(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("project_phases")
    .select("id, project_id, name, sort_order")
    .eq("company_id", companyId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    sortOrder: row.sort_order,
  })) as CommandCenterPhaseRow[];
}

async function loadProjectPhotos(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("project_photos")
    .select("id, project_id, captured_at, created_at, uploaded_by")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    uploadedBy: row.uploaded_by,
  })) as CommandCenterPhotoRow[];
}

async function loadProfiles(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("company_id", companyId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
  })) as CommandCenterProfileRow[];
}

async function loadEstimates(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("estimates")
    .select("id, project_id, title, estimate_number, status, expiration_date, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    estimateNumber: row.estimate_number,
    status: row.status,
    expirationDate: row.expiration_date,
    createdAt: row.created_at,
  })) as CommandCenterEstimateRow[];
}

async function loadInvoices(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, project_id, title, invoice_number, status, total_amount, amount_paid, due_date, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    invoiceNumber: row.invoice_number,
    status: row.status,
    totalAmount: row.total_amount,
    amountPaid: row.amount_paid,
    dueDate: row.due_date,
    createdAt: row.created_at,
  })) as CommandCenterInvoiceRow[];
}

async function loadChangeOrders(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("change_orders")
    .select("id, project_id, title, change_order_number, status, requested_date, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    changeOrderNumber: row.change_order_number,
    status: row.status,
    requestedDate: row.requested_date,
    createdAt: row.created_at,
  })) as CommandCenterChangeOrderRow[];
}

function groupBy<T>(items: T[], keySelector: (item: T) => string) {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = keySelector(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }

  return map;
}

async function loadEquipment(supabase: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await supabase
    .from("equipment")
    .select("id, equipment_number, name, status, maintenance_status, assigned_job_id, next_service_date")
    .eq("company_id", companyId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    equipmentNumber: row.equipment_number,
    name: row.name,
    status: row.status,
    maintenanceStatus: row.maintenance_status,
    assignedJobId: row.assigned_job_id,
    nextServiceDate: row.next_service_date,
  })) as CommandCenterEquipmentRow[];
}

async function buildTimelineActivityFeed(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  projectNameById: Map<string, string>;
}) {
  const timeline = createOrionTimelineService(params.supabase);
  const result = await timeline.listCompanyTimeline(params.companyId, {
    pageSize: 24,
    includeLegacyAdapters: false,
  });

  return result.items.map((item) => {
    const user = item.actorName || "System";
    const projectName = item.projectName || (item.projectId ? params.projectNameById.get(item.projectId) : undefined) || undefined;

    return {
      id: item.id,
      icon: item.sourceModule === "workforce" ? "W" : item.sourceModule === "invoices" ? "I" : "O",
      category: mapTimelineCategory(item.category),
      timestampMinutesAgo: diffMinutes(item.occurredAt),
      user,
      avatarLabel: initials(user),
      actionLabelKey: null,
      actionLabel: item.summary,
      projectName,
      href: item.href || (item.projectId ? `/projects/${item.projectId}` : "/operations"),
    };
  })
    .filter((item) => Number.isFinite(item.timestampMinutesAgo))
    .sort((left, right) => left.timestampMinutesAgo - right.timestampMinutesAgo)
    .slice(0, 18);
}

function mapTimelineCategory(category: string): "customer" | "project" | "sitecam" | "estimate" | "invoice" | "team" {
  if (category === "customers") {
    return "customer";
  }

  if (category === "sales") {
    return "estimate";
  }

  if (category === "finance") {
    return "invoice";
  }

  if (category === "workforce") {
    return "team";
  }

  if (category === "field") {
    return "sitecam";
  }

  return "project";
}

function diffMinutes(isoValue: string) {
  const timestamp = new Date(isoValue).getTime();
  if (Number.isNaN(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "--";
  }

  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}
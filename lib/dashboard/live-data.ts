import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeChangeOrderStatus } from "@/lib/change-orders/statuses";
import { normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import { calculateProjectIntelligence } from "@/lib/project-intelligence/calculate-project-intelligence";
import { normalizeProjectStatus } from "@/lib/projects";
import type { CompanyRole } from "@/lib/supabase/authorization";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import type {
  AIRecommendation,
  BusinessHealthSummary,
  DashboardActivityItem,
  DashboardMetric,
  DashboardSectionErrors,
  DashboardSectionId,
  ExecutiveDashboardData,
  ProjectHealthRow,
  ScheduleEvent,
} from "./types";

type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "status" | "estimated_end_date" | "contract_amount" | "estimated_cost" | "description"
>;

type TaskRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  | "id"
  | "project_id"
  | "title"
  | "status"
  | "completion_percentage"
  | "planned_start"
  | "planned_finish"
  | "estimated_completion_date"
  | "assigned_profile_id"
  | "phase_id"
  | "actual_start"
  | "actual_finish"
>;

type ProjectPhaseRow = Pick<
  Database["public"]["Tables"]["project_phases"]["Row"],
  "id" | "project_id" | "name" | "sort_order"
>;

type ProjectPhotoRow = Pick<
  Database["public"]["Tables"]["project_photos"]["Row"],
  "id" | "project_id" | "captured_at" | "created_at" | "uploaded_by"
>;

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name"
>;

type EstimateRow = Pick<
  Database["public"]["Tables"]["estimates"]["Row"],
  "id" | "project_id" | "title" | "estimate_number" | "status" | "expiration_date" | "created_at"
>;

type InvoiceRow = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  | "id"
  | "project_id"
  | "title"
  | "invoice_number"
  | "status"
  | "total_amount"
  | "amount_paid"
  | "due_date"
  | "sent_at"
  | "paid_date"
  | "created_at"
>;

type InvoicePaymentRow = Pick<
  Database["public"]["Tables"]["invoice_payment_history"]["Row"],
  "id" | "invoice_id" | "amount" | "status" | "payment_date" | "created_at" | "created_by"
>;

type ChangeOrderRow = Pick<
  Database["public"]["Tables"]["change_orders"]["Row"],
  "id" | "project_id" | "title" | "change_order_number" | "status" | "total_amount" | "requested_date" | "created_at"
>;

type ChangeOrderActivityRow = Pick<
  Database["public"]["Tables"]["change_order_activity"]["Row"],
  "id" | "change_order_id" | "activity_type" | "description" | "created_at" | "created_by"
>;

type BangoMemoryRow = {
  id: string;
  company_id: string;
  category: string;
  title: string;
  summary: string;
  project_id: string | null;
  verified_at: string | null;
  verified_by: string | null;
  confidence: string;
  status: string;
};

type DatabaseWithBangoMemories = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      bango_memories: {
        Row: BangoMemoryRow;
        Insert: Partial<BangoMemoryRow>;
        Update: Partial<BangoMemoryRow>;
        Relationships: [];
      };
    };
  };
};

export type BuildExecutiveDashboardResult = {
  companyName: string | null;
  sectionErrors: DashboardSectionErrors;
  data: ExecutiveDashboardData;
};

const FINANCIAL_ROLES = new Set<CompanyRole | string>(["owner", "administrator", "operations_manager", "accountant"]);
const ACTIVE_PROJECT_STATUSES = new Set(["approved", "scheduled", "in_progress"]);
const OPEN_ESTIMATE_STATUSES = new Set(["draft", "internal_review", "sent", "viewed", "ready", "revision_requested"]);
const OPEN_INVOICE_STATUSES = new Set(["draft", "sent", "viewed", "partially_paid", "overdue", "partial"]);
const ACTIVE_TASK_STATUSES = new Set(["not_started", "in_progress", "blocked"]);

export async function buildExecutiveDashboardData(
  supabase: SupabaseClient<Database>,
  workspace: WorkspaceContext,
): Promise<BuildExecutiveDashboardResult> {
  const sectionErrors: DashboardSectionErrors = {};
  const [
    projects,
    tasks,
    phases,
    photos,
    profiles,
    estimates,
    invoices,
    payments,
    changeOrders,
    changeOrderActivity,
    memories,
  ] = await Promise.all([
    loadProjects(supabase, workspace.companyId, sectionErrors),
    loadTasks(supabase, workspace.companyId, sectionErrors),
    loadProjectPhases(supabase, workspace.companyId, sectionErrors),
    loadProjectPhotos(supabase, workspace.companyId, sectionErrors),
    loadProfiles(supabase),
    loadEstimates(supabase, workspace.companyId, sectionErrors),
    loadInvoices(supabase, workspace.companyId, sectionErrors),
    loadInvoicePayments(supabase, workspace.companyId, sectionErrors),
    loadChangeOrders(supabase, workspace.companyId, sectionErrors),
    loadChangeOrderActivity(supabase, workspace.companyId, sectionErrors),
    loadVerifiedMemories(supabase, workspace.companyId),
  ]);

  const canReadFinancials = FINANCIAL_ROLES.has(workspace.role ?? "employee");
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const tasksByProject = groupBy(tasks, (task) => task.project_id);
  const invoicesByProject = groupBy(invoices.filter((invoice) => invoice.project_id), (invoice) => invoice.project_id as string);
  const photosByProject = groupBy(photos, (photo) => photo.project_id);

  const metrics = buildMetrics(projects, tasks, estimates, invoices, payments, canReadFinancials);
  const projectHealth = buildProjectHealth(projects, tasksByProject, invoicesByProject, phaseById, photosByProject);
  const schedule = buildSchedule(tasks, projectById);
  const activities = buildActivities(photos, invoices, payments, changeOrders, changeOrderActivity, memories, profileById, projectById);
  const businessSummary = buildBusinessSummary(projectHealth.projects, tasks, photos, invoices, canReadFinancials);
  const recommendations = buildRecommendations(projectHealth.projects, tasks, invoices, changeOrders, canReadFinancials);

  return {
    companyName: workspace.companyName?.trim() || null,
    sectionErrors,
    data: {
      metrics,
      activities,
      projectHealth,
      schedule,
      weather: null,
      businessScore: null,
      businessSummary,
      recommendations,
      widgetDefinitions: [
        { id: "kpi", titleKey: "dashboard.metricSectionTitle", descriptionKey: "dashboard.metricSectionDescription" },
        { id: "schedule", titleKey: "dashboard.todaySchedule", descriptionKey: "dashboard.todayScheduleDescription" },
        { id: "project-health", titleKey: "dashboard.projectHealth", descriptionKey: "dashboard.projectHealthDescription" },
        { id: "weather", titleKey: "dashboard.weather", descriptionKey: "dashboard.weatherDescription" },
        { id: "activity", titleKey: "dashboard.recentActivity", descriptionKey: "dashboard.recentActivityDescription" },
        { id: "business-score", titleKey: "dashboard.businessScoreTitle", descriptionKey: "dashboard.businessScoreDescription" },
        { id: "command-center", titleKey: "dashboard.commandCenterTitle", descriptionKey: "dashboard.commandCenterDescription" },
      ],
    },
  };
}

async function loadProjects(supabase: SupabaseClient<Database>, companyId: string, sectionErrors: DashboardSectionErrors) {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status, estimated_end_date, contract_amount, estimated_cost, description")
      .eq("company_id", companyId);

    if (error) {
      throw error;
    }

    return (data ?? []) as ProjectRow[];
  } catch (error) {
    markError(sectionErrors, "project-health", error);
    markError(sectionErrors, "kpi", error);
    markError(sectionErrors, "command-center", error);
    return [] as ProjectRow[];
  }
}

async function loadTasks(supabase: SupabaseClient<Database>, companyId: string, sectionErrors: DashboardSectionErrors) {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, project_id, title, status, completion_percentage, planned_start, planned_finish, estimated_completion_date, assigned_profile_id, phase_id, actual_start, actual_finish")
      .eq("company_id", companyId);

    if (error) {
      throw error;
    }

    return (data ?? []) as TaskRow[];
  } catch (error) {
    markError(sectionErrors, "schedule", error);
    markError(sectionErrors, "project-health", error);
    markError(sectionErrors, "kpi", error);
    markError(sectionErrors, "command-center", error);
    return [] as TaskRow[];
  }
}

async function loadProjectPhases(supabase: SupabaseClient<Database>, companyId: string, sectionErrors: DashboardSectionErrors) {
  try {
    const { data, error } = await supabase
      .from("project_phases")
      .select("id, project_id, name, sort_order")
      .eq("company_id", companyId);

    if (error) {
      throw error;
    }

    return (data ?? []) as ProjectPhaseRow[];
  } catch (error) {
    markError(sectionErrors, "project-health", error);
    return [] as ProjectPhaseRow[];
  }
}

async function loadProjectPhotos(supabase: SupabaseClient<Database>, companyId: string, sectionErrors: DashboardSectionErrors) {
  try {
    const { data, error } = await supabase
      .from("project_photos")
      .select("id, project_id, captured_at, created_at, uploaded_by")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(120);

    if (error) {
      throw error;
    }

    return (data ?? []) as ProjectPhotoRow[];
  } catch (error) {
    markError(sectionErrors, "activity", error);
    markError(sectionErrors, "project-health", error);
    markError(sectionErrors, "business-score", error);
    return [] as ProjectPhotoRow[];
  }
}

async function loadProfiles(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.from("profiles").select("id, first_name, last_name");
  return (data ?? []) as ProfileRow[];
}

async function loadEstimates(supabase: SupabaseClient<Database>, companyId: string, sectionErrors: DashboardSectionErrors) {
  try {
    const { data, error } = await supabase
      .from("estimates")
      .select("id, project_id, title, estimate_number, status, expiration_date, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(120);

    if (error) {
      throw error;
    }

    return (data ?? []) as EstimateRow[];
  } catch (error) {
    markError(sectionErrors, "kpi", error);
    return [] as EstimateRow[];
  }
}

async function loadInvoices(supabase: SupabaseClient<Database>, companyId: string, sectionErrors: DashboardSectionErrors) {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, project_id, title, invoice_number, status, total_amount, amount_paid, due_date, sent_at, paid_date, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(120);

    if (error) {
      throw error;
    }

    return (data ?? []) as InvoiceRow[];
  } catch (error) {
    markError(sectionErrors, "kpi", error);
    markError(sectionErrors, "business-score", error);
    markError(sectionErrors, "activity", error);
    markError(sectionErrors, "command-center", error);
    return [] as InvoiceRow[];
  }
}

async function loadInvoicePayments(supabase: SupabaseClient<Database>, companyId: string, sectionErrors: DashboardSectionErrors) {
  try {
    const { data, error } = await supabase
      .from("invoice_payment_history")
      .select("id, invoice_id, amount, status, payment_date, created_at, created_by")
      .eq("company_id", companyId)
      .order("payment_date", { ascending: false })
      .limit(120);

    if (error) {
      throw error;
    }

    return (data ?? []) as InvoicePaymentRow[];
  } catch (error) {
    markError(sectionErrors, "kpi", error);
    markError(sectionErrors, "activity", error);
    return [] as InvoicePaymentRow[];
  }
}

async function loadChangeOrders(supabase: SupabaseClient<Database>, companyId: string, sectionErrors: DashboardSectionErrors) {
  try {
    const { data, error } = await supabase
      .from("change_orders")
      .select("id, project_id, title, change_order_number, status, total_amount, requested_date, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(120);

    if (error) {
      throw error;
    }

    return (data ?? []) as ChangeOrderRow[];
  } catch (error) {
    markError(sectionErrors, "activity", error);
    markError(sectionErrors, "command-center", error);
    return [] as ChangeOrderRow[];
  }
}

async function loadChangeOrderActivity(supabase: SupabaseClient<Database>, companyId: string, sectionErrors: DashboardSectionErrors) {
  try {
    const { data, error } = await supabase
      .from("change_order_activity")
      .select("id, change_order_id, activity_type, description, created_at, created_by")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(120);

    if (error) {
      throw error;
    }

    return (data ?? []) as ChangeOrderActivityRow[];
  } catch (error) {
    markError(sectionErrors, "activity", error);
    return [] as ChangeOrderActivityRow[];
  }
}

async function loadVerifiedMemories(supabase: SupabaseClient<Database>, companyId: string) {
  try {
    const supabaseWithMemories = supabase as unknown as SupabaseClient<DatabaseWithBangoMemories>;
    const { data, error } = await supabaseWithMemories
      .from("bango_memories")
      .select("id, company_id, category, title, summary, project_id, verified_at, verified_by, confidence, status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .eq("confidence", "verified")
      .not("verified_at", "is", null)
      .order("verified_at", { ascending: false })
      .limit(40);

    if (error) {
      throw error;
    }

    return data ?? [];
  } catch {
    return [] as BangoMemoryRow[];
  }
}

function buildMetrics(
  projects: ProjectRow[],
  tasks: TaskRow[],
  estimates: EstimateRow[],
  invoices: InvoiceRow[],
  payments: InvoicePaymentRow[],
  canReadFinancials: boolean,
): DashboardMetric[] {
  const activeProjects = projects.filter((project) => ACTIVE_PROJECT_STATUSES.has(normalizeProjectStatus(project.status).key)).length;
  const assignedToActiveWork = new Set(
    tasks
      .filter((task) => ACTIVE_TASK_STATUSES.has(task.status.trim().toLowerCase()))
      .map((task) => task.assigned_profile_id)
      .filter((id): id is string => Boolean(id)),
  ).size;
  const openEstimates = estimates.filter((estimate) => OPEN_ESTIMATE_STATUSES.has(estimate.status.trim().toLowerCase())).length;
  const openInvoices = invoices.filter((invoice) => OPEN_INVOICE_STATUSES.has(normalizeInvoiceStatus(invoice.status))).length;
  const revenueThisMonth = sumCurrentMonthPayments(payments);
  const healthScore = averageHealthScore(projects, tasks, invoices);

  return [
    makeMetric("active-projects", "P", "dashboard.metricActiveProjects", activeProjects, "/projects", "dashboard.metricActiveProjectsTooltip", "dashboard.metricActiveProjectsSubtitle"),
    makeMetric("assigned-active-work", "A", "dashboard.metricAssignedActiveWork", assignedToActiveWork, "/team", "dashboard.metricAssignedActiveWorkTooltip", "dashboard.metricAssignedActiveWorkSubtitle", "dashboard.metricAssignedActiveWorkTrend"),
    makeMetric("open-estimates", "S", "dashboard.metricOpenEstimates", openEstimates, "/estimates", "dashboard.metricOpenEstimatesTooltip", "dashboard.metricOpenEstimatesSubtitle"),
    canReadFinancials
      ? makeMetric("open-invoices", "I", "dashboard.metricOpenInvoices", openInvoices, "/invoices", "dashboard.metricOpenInvoicesTooltip", "dashboard.metricOpenInvoicesSubtitle")
      : makeRestrictedMetric("open-invoices", "I", "dashboard.metricOpenInvoices", "/invoices", "dashboard.metricOpenInvoicesTooltip"),
    canReadFinancials
      ? makeMetric("revenue-this-month", "$", "dashboard.metricRevenueThisMonth", revenueThisMonth, "/invoices", "dashboard.metricRevenueThisMonthTooltip", "dashboard.metricRevenueThisMonthSubtitle", undefined, "currency")
      : makeRestrictedMetric("revenue-this-month", "$", "dashboard.metricRevenueThisMonth", "/invoices", "dashboard.metricRevenueThisMonthTooltip"),
    makeMetric("health-score", "AI", "dashboard.metricHealthScore", healthScore, "/dashboard", "dashboard.metricHealthScoreTooltip", "dashboard.metricHealthScoreSubtitle", undefined, "score"),
  ];
}

function buildProjectHealth(
  projects: ProjectRow[],
  tasksByProject: Map<string, TaskRow[]>,
  invoicesByProject: Map<string, InvoiceRow[]>,
  phaseById: Map<string, ProjectPhaseRow>,
  photosByProject: Map<string, ProjectPhotoRow[]>,
) {
  const rows = projects
    .filter((project) => ACTIVE_PROJECT_STATUSES.has(normalizeProjectStatus(project.status).key))
    .map((project) => buildProjectHealthRow(project, tasksByProject.get(project.id) ?? [], invoicesByProject.get(project.id) ?? [], phaseById, photosByProject.get(project.id) ?? []))
    .sort((left, right) => left.healthScore - right.healthScore)
    .slice(0, 5);

  return {
    onScheduleCount: rows.filter((row) => row.riskIndicator === "low").length,
    atRiskCount: rows.filter((row) => row.riskIndicator === "medium").length,
    behindScheduleCount: rows.filter((row) => row.riskIndicator === "high").length,
    projects: rows,
  };
}

function buildProjectHealthRow(
  project: ProjectRow,
  tasks: TaskRow[],
  invoices: InvoiceRow[],
  phaseById: Map<string, ProjectPhaseRow>,
  photos: ProjectPhotoRow[],
): ProjectHealthRow {
  const intelligence = calculateProjectIntelligence({
    project,
    tasks,
    invoices,
    counts: {
      estimates: 0,
      changeOrders: 0,
      photos: photos.length,
    },
  });

  const recentPhoto = photos
    .map((photo) => photo.captured_at || photo.created_at)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return {
    id: project.id,
    projectName: project.name,
    healthScore: intelligence.summary.healthScore ?? 0,
    budgetStatusKey: toBudgetStatusKey(project, invoices),
    scheduleStatusKey: toScheduleStatusKey(intelligence.summary.overdueTasks),
    lastPhotoUpload: recentPhoto ? formatRelativeTime(recentPhoto) : "--",
    lastDailyReport: "--",
    currentPhase: deriveCurrentPhase(tasks, phaseById),
    riskIndicator: toRiskIndicator(intelligence.summary.blockedTasks, intelligence.summary.overdueTasks),
    href: `/projects/${project.id}`,
  };
}

function buildSchedule(tasks: TaskRow[], projectById: Map<string, ProjectRow>): ScheduleEvent[] {
  return tasks
    .filter((task) => ACTIVE_TASK_STATUSES.has(task.status.trim().toLowerCase()))
    .filter((task) => Boolean(task.planned_start || task.planned_finish || task.estimated_completion_date))
    .map((task) => {
      const source = task.planned_start || task.planned_finish || task.estimated_completion_date;
      const period = deriveSchedulePeriod(task.planned_start, task.planned_finish, task.estimated_completion_date);
      return {
        id: `task-${task.id}`,
        period,
        timeLabel: formatScheduleTimeLabel(task.planned_start, period),
        titleKey: null,
        title: task.title,
        projectName: projectById.get(task.project_id)?.name || "Project",
        location: "",
        employeesAssigned: task.assigned_profile_id ? 1 : 0,
        status: toScheduleEventStatus(task.status),
        href: `/projects/${task.project_id}`,
        occurredAt: source,
      };
    })
    .sort((left, right) => compareIso(right.occurredAt) - compareIso(left.occurredAt))
    .slice(0, 8);
}

function buildActivities(
  photos: ProjectPhotoRow[],
  invoices: InvoiceRow[],
  payments: InvoicePaymentRow[],
  changeOrders: ChangeOrderRow[],
  changeOrderActivity: ChangeOrderActivityRow[],
  memories: BangoMemoryRow[],
  profileById: Map<string, ProfileRow>,
  projectById: Map<string, ProjectRow>,
): DashboardActivityItem[] {
  const items: DashboardActivityItem[] = [];
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const changeOrderById = new Map(changeOrders.map((changeOrder) => [changeOrder.id, changeOrder]));

  for (const photo of photos.slice(0, 12)) {
    const user = formatProfileName(profileById.get(photo.uploaded_by || ""));
    items.push({
      id: `photo-${photo.id}`,
      icon: "SC",
      category: "sitecam",
      timestampMinutesAgo: diffMinutes(photo.captured_at || photo.created_at),
      user,
      avatarLabel: initials(user),
      actionLabelKey: "dashboard.activityPhotoUploaded",
      actionLabel: null,
      projectName: projectById.get(photo.project_id)?.name,
      href: `/projects/${photo.project_id}`,
    });
  }

  for (const payment of payments.slice(0, 10)) {
    const invoice = invoiceById.get(payment.invoice_id);
    const user = formatProfileName(profileById.get(payment.created_by || ""));
    items.push({
      id: `payment-${payment.id}`,
      icon: "I",
      category: "invoice",
      timestampMinutesAgo: diffMinutes(payment.created_at || payment.payment_date),
      user,
      avatarLabel: initials(user),
      actionLabelKey: "dashboard.activityPaymentRecorded",
      actionLabel: null,
      projectName: invoice?.project_id ? projectById.get(invoice.project_id)?.name : undefined,
      href: invoice?.project_id ? `/projects/${invoice.project_id}` : "/invoices",
    });
  }

  for (const invoice of invoices.slice(0, 12)) {
    if (invoice.sent_at) {
      items.push({
        id: `invoice-sent-${invoice.id}`,
        icon: "I",
        category: "invoice",
        timestampMinutesAgo: diffMinutes(invoice.sent_at),
        user: "System",
        avatarLabel: "SY",
        actionLabelKey: "dashboard.activityInvoiceSent",
        actionLabel: null,
        projectName: invoice.project_id ? projectById.get(invoice.project_id)?.name : undefined,
        href: invoice.project_id ? `/projects/${invoice.project_id}` : "/invoices",
      });
    }

    if (invoice.paid_date || normalizeInvoiceStatus(invoice.status) === "paid") {
      items.push({
        id: `invoice-paid-${invoice.id}`,
        icon: "I",
        category: "invoice",
        timestampMinutesAgo: diffMinutes(invoice.paid_date || invoice.created_at),
        user: "System",
        avatarLabel: "SY",
        actionLabelKey: "dashboard.activityInvoicePaid",
        actionLabel: null,
        projectName: invoice.project_id ? projectById.get(invoice.project_id)?.name : undefined,
        href: invoice.project_id ? `/projects/${invoice.project_id}` : "/invoices",
      });
    }
  }

  for (const activity of changeOrderActivity.slice(0, 10)) {
    const changeOrder = changeOrderById.get(activity.change_order_id);
    const user = formatProfileName(profileById.get(activity.created_by || ""));
    items.push({
      id: `change-order-${activity.id}`,
      icon: "CO",
      category: "project",
      timestampMinutesAgo: diffMinutes(activity.created_at),
      user,
      avatarLabel: initials(user),
      actionLabelKey: null,
      actionLabel: activity.description,
      projectName: changeOrder?.project_id ? projectById.get(changeOrder.project_id)?.name : undefined,
      href: "/change-orders",
    });
  }

  for (const memory of memories.slice(0, 10)) {
    const user = formatProfileName(profileById.get(memory.verified_by || ""));
    items.push({
      id: `memory-${memory.id}`,
      icon: "M",
      category: "project",
      timestampMinutesAgo: diffMinutes(memory.verified_at || ""),
      user,
      avatarLabel: initials(user),
      actionLabelKey: "dashboard.activityVerifiedMemory",
      actionLabel: memory.title,
      projectName: memory.project_id ? projectById.get(memory.project_id)?.name : undefined,
      href: memory.project_id ? `/projects/${memory.project_id}` : "/settings/memory-review",
    });
  }

  return items
    .filter((item) => Number.isFinite(item.timestampMinutesAgo))
    .sort((left, right) => left.timestampMinutesAgo - right.timestampMinutesAgo)
    .slice(0, 18);
}

function buildBusinessSummary(
  projectHealthRows: ProjectHealthRow[],
  tasks: TaskRow[],
  photos: ProjectPhotoRow[],
  invoices: InvoiceRow[],
  canReadFinancials: boolean,
): BusinessHealthSummary {
  const overdueTasks = tasks.filter((task) => task.planned_finish && task.planned_finish < todayIso() && task.status.trim().toLowerCase() !== "completed").length;
  const blockedTasks = tasks.filter((task) => task.status.trim().toLowerCase() === "blocked").length;
  const recentPhotos = photos.filter((photo) => diffDays(photo.captured_at || photo.created_at) <= 7).length;
  const overdueInvoices = invoices.filter((invoice) => invoice.due_date && invoice.due_date < todayIso() && Math.max(0, invoice.total_amount - invoice.amount_paid) > 0).length;

  return {
    items: [
      {
        id: "projects",
        labelKey: "dashboard.businessScoreProjects",
        state: projectHealthRows.some((project) => project.riskIndicator === "high") ? "attention" : "healthy",
        detailsKey: "dashboard.businessSummaryProjectsDetails",
      },
      {
        id: "financial",
        labelKey: "dashboard.businessScoreFinancial",
        state: canReadFinancials ? (overdueInvoices > 0 ? "attention" : "healthy") : "restricted",
        detailsKey: "dashboard.businessSummaryFinancialDetails",
      },
      {
        id: "scheduling",
        labelKey: "dashboard.businessScoreScheduling",
        state: overdueTasks > 0 || blockedTasks > 0 ? "attention" : "healthy",
        detailsKey: "dashboard.businessSummarySchedulingDetails",
      },
      {
        id: "documentation",
        labelKey: "dashboard.businessScoreDocumentation",
        state: recentPhotos > 0 ? "healthy" : "attention",
        detailsKey: "dashboard.businessSummaryDocumentationDetails",
      },
      {
        id: "safety",
        labelKey: "dashboard.businessScoreSafety",
        state: "unavailable",
        detailsKey: "dashboard.businessSummarySafetyDetails",
      },
    ],
  };
}

function buildRecommendations(
  projectHealthRows: ProjectHealthRow[],
  tasks: TaskRow[],
  invoices: InvoiceRow[],
  changeOrders: ChangeOrderRow[],
  canReadFinancials: boolean,
): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];
  const highRiskProject = projectHealthRows.find((project) => project.riskIndicator === "high");
  if (highRiskProject) {
    recommendations.push({
      id: `project-risk-${highRiskProject.id}`,
      icon: "P",
      priority: "high",
      timestampMinutesAgo: 5,
      messageKey: "dashboard.recommendationHighRiskProject",
      actions: [
        { id: `review-${highRiskProject.id}`, labelKey: "dashboard.actionReviewProject", intent: "primary" },
        { id: `dismiss-${highRiskProject.id}`, labelKey: "dashboard.actionDismiss", intent: "ghost" },
      ],
    });
  }

  const overdueInvoices = invoices.filter((invoice) => invoice.due_date && invoice.due_date < todayIso() && Math.max(0, invoice.total_amount - invoice.amount_paid) > 0).length;
  if (canReadFinancials && overdueInvoices > 0) {
    recommendations.push({
      id: "overdue-invoices",
      icon: "I",
      priority: overdueInvoices >= 3 ? "critical" : "high",
      timestampMinutesAgo: 10,
      messageKey: "dashboard.recommendationOverdueInvoices",
      actions: [
        { id: "review-invoices", labelKey: "dashboard.actionViewInvoice", intent: "secondary" },
        { id: "remind-invoices", labelKey: "dashboard.actionSendReminder", intent: "primary" },
      ],
    });
  }

  const blockedTasks = tasks.filter((task) => task.status.trim().toLowerCase() === "blocked").length;
  if (blockedTasks > 0) {
    recommendations.push({
      id: "blocked-tasks",
      icon: "T",
      priority: blockedTasks >= 3 ? "high" : "medium",
      timestampMinutesAgo: 15,
      messageKey: "dashboard.recommendationBlockedTasks",
      actions: [
        { id: "review-blocked", labelKey: "dashboard.actionReviewProject", intent: "secondary" },
        { id: "dismiss-blocked", labelKey: "dashboard.actionDismiss", intent: "ghost" },
      ],
    });
  }

  const pendingApprovals = changeOrders.filter((changeOrder) => normalizeChangeOrderStatus(changeOrder.status) === "pending_approval").length;
  if (pendingApprovals > 0) {
    recommendations.push({
      id: "pending-change-orders",
      icon: "CO",
      priority: "medium",
      timestampMinutesAgo: 20,
      messageKey: "dashboard.recommendationPendingChangeOrders",
      actions: [
        { id: "review-change-orders", labelKey: "dashboard.actionReviewProject", intent: "secondary" },
        { id: "dismiss-change-orders", labelKey: "dashboard.actionDismiss", intent: "ghost" },
      ],
    });
  }

  return recommendations.slice(0, 4);
}

function averageHealthScore(projects: ProjectRow[], tasks: TaskRow[], invoices: InvoiceRow[]) {
  const tasksByProject = groupBy(tasks, (task) => task.project_id);
  const invoicesByProject = groupBy(invoices.filter((invoice) => invoice.project_id), (invoice) => invoice.project_id as string);
  const activeProjects = projects.filter((project) => ACTIVE_PROJECT_STATUSES.has(normalizeProjectStatus(project.status).key));

  if (activeProjects.length === 0) {
    return 0;
  }

  const total = activeProjects.reduce((sum, project) => {
    const intelligence = calculateProjectIntelligence({
      project,
      tasks: tasksByProject.get(project.id) ?? [],
      invoices: invoicesByProject.get(project.id) ?? [],
      counts: { estimates: 0, changeOrders: 0, photos: 0 },
    });

    return sum + (intelligence.summary.healthScore ?? 0);
  }, 0);

  return Math.round(total / activeProjects.length);
}

function deriveCurrentPhase(tasks: TaskRow[], phaseById: Map<string, ProjectPhaseRow>) {
  const activeTask = tasks
    .filter((task) => task.phase_id)
    .sort((left, right) => taskPriority(left.status) - taskPriority(right.status))[0];

  if (!activeTask?.phase_id) {
    return "--";
  }

  return phaseById.get(activeTask.phase_id)?.name || "--";
}

function taskPriority(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "in_progress") {
    return 0;
  }

  if (normalized === "blocked") {
    return 1;
  }

  if (normalized === "not_started") {
    return 2;
  }

  return 3;
}

function toBudgetStatusKey(project: ProjectRow, invoices: InvoiceRow[]) {
  const budget = project.contract_amount ?? project.estimated_cost;
  if (!budget || budget <= 0) {
    return "dashboard.projectBudgetWatch";
  }

  const paid = invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount_paid), 0);
  const ratio = paid / budget;
  if (ratio >= 1) {
    return "dashboard.projectBudgetOver";
  }

  if (ratio >= 0.85) {
    return "dashboard.projectBudgetWatch";
  }

  return "dashboard.projectBudgetHealthy";
}

function toScheduleStatusKey(overdueTasks: number) {
  if (overdueTasks >= 3) {
    return "dashboard.projectScheduleAtRisk";
  }

  if (overdueTasks >= 1) {
    return "dashboard.projectScheduleSlightDelay";
  }

  return "dashboard.projectScheduleOnTrack";
}

function toRiskIndicator(blockedTasks: number, overdueTasks: number): "low" | "medium" | "high" {
  if (blockedTasks >= 2 || overdueTasks >= 3) {
    return "high";
  }

  if (blockedTasks >= 1 || overdueTasks >= 1) {
    return "medium";
  }

  return "low";
}

function deriveSchedulePeriod(plannedStart: string | null, plannedFinish: string | null, estimatedCompletionDate: string | null): ScheduleEvent["period"] {
  const source = plannedStart || plannedFinish || estimatedCompletionDate;
  if (!source) {
    return "time_unavailable";
  }

  if (!source.includes("T")) {
    return plannedStart || plannedFinish ? "all_day" : "time_unavailable";
  }

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) {
    return "time_unavailable";
  }

  const hour = date.getHours();
  if (hour < 12) {
    return "morning";
  }

  if (hour < 18) {
    return "afternoon";
  }

  return "evening";
}

function formatScheduleTimeLabel(plannedStart: string | null, period: ScheduleEvent["period"]) {
  if (!plannedStart) {
    return period === "all_day" ? "__all_day__" : "__time_unavailable__";
  }

  if (!plannedStart.includes("T")) {
    return "__all_day__";
  }

  const date = new Date(plannedStart);
  if (Number.isNaN(date.getTime())) {
    return "__time_unavailable__";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toScheduleEventStatus(status: string): ScheduleEvent["status"] {
  return status.trim().toLowerCase() === "blocked" ? "pending" : "confirmed";
}

function makeMetric(
  id: string,
  icon: string,
  titleKey: string,
  value: number,
  href: string,
  tooltipKey: string,
  subtitleKey?: string,
  trendLabelKey?: string,
  valueKind: DashboardMetric["valueKind"] = "number",
): DashboardMetric {
  return {
    id,
    icon,
    titleKey,
    value,
    valueKind,
    href,
    tooltipKey,
    subtitleKey,
    trendLabelKey,
  };
}

function makeRestrictedMetric(
  id: string,
  icon: string,
  titleKey: string,
  href: string,
  tooltipKey: string,
): DashboardMetric {
  return {
    id,
    icon,
    titleKey,
    value: 0,
    valueKind: "number",
    href,
    tooltipKey,
    displayValueKey: "dashboard.metricRestrictedValue",
    subtitleKey: "dashboard.metricRestrictedSubtitle",
  };
}

function markError(sectionErrors: DashboardSectionErrors, section: DashboardSectionId, error: unknown) {
  if (sectionErrors[section]) {
    return;
  }

  sectionErrors[section] = error instanceof Error ? error.message : "We could not load this section right now.";
}

function groupBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) {
      continue;
    }

    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  return map;
}

function sumCurrentMonthPayments(payments: InvoicePaymentRow[]) {
  const now = new Date();
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();

  return payments.reduce((sum, payment) => {
    if (payment.status.trim().toLowerCase() === "void") {
      return sum;
    }

    const date = new Date(payment.payment_date);
    if (Number.isNaN(date.getTime())) {
      return sum;
    }

    if (date.getUTCMonth() !== currentMonth || date.getUTCFullYear() !== currentYear) {
      return sum;
    }

    return sum + Math.max(0, payment.amount);
  }, 0);
}

function diffMinutes(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function diffDays(value: string) {
  return Math.floor(diffMinutes(value) / 1440);
}

function compareIso(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatRelativeTime(value: string) {
  const minutes = diffMinutes(value);
  if (!Number.isFinite(minutes)) {
    return "--";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}

function formatProfileName(profile?: ProfileRow) {
  if (!profile) {
    return "System";
  }

  const firstName = profile.first_name?.trim() || "";
  const lastName = profile.last_name?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "System";
}

function initials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) || "S";
  const second = parts[1]?.charAt(0) || "Y";
  return `${first}${second}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
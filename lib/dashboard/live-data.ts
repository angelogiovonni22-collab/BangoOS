import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeChangeOrderStatus } from "@/lib/change-orders/statuses";
import { normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import { calculateProjectIntelligence } from "@/lib/project-intelligence/calculate-project-intelligence";
import { normalizeProjectStatus } from "@/lib/projects";
import { createOrionTimelineService } from "@/lib/orion/timeline";
import type { OrionTimelineItem } from "@/lib/orion/timeline";
import { createOrionDecisionEngine } from "@/lib/orion/decision";
import type { CompanyRole } from "@/lib/supabase/authorization";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import type {
  AIRecommendation,
  DashboardAutomationQueueItem,
  DashboardDecisionHealthItem,
  DashboardDecisionItem,
  DashboardDecisionRiskSummary,
  DashboardEstimatePipeline,
  DashboardMorningBriefing,
  DashboardPendingFollowupItem,
  DashboardRecentAutomationItem,
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

type WorkflowEventActivityRow = {
  id: string;
  company_id: string;
  event_type: string;
  reference_entity: string;
  reference_id: string;
  occurred_at: string;
  payload: Record<string, unknown>;
};

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
    loadEstimates(supabase, work…13817 tokens truncated…| "documentation" | "safety";
  labelKey: string;
  score: number;
  detailsKey: string;
};

export type AIBusinessScoreSnapshot = {
  score: number;
  ratingKey: string;
  breakdown: BusinessScoreBreakdownItem[];
};

export type BusinessHealthSummaryItem = {
  id: "projects" | "financial" | "scheduling" | "documentation" | "safety";
  labelKey: string;
  state: "healthy" | "attention" | "restricted" | "unavailable";
  detailsKey: string;
};

export type BusinessHealthSummary = {
  items: BusinessHealthSummaryItem[];
};

export type AIRecommendationAction = {
  id: string;
  labelKey: string;
  intent: "primary" | "secondary" | "ghost";
};

export type AIRecommendation = {
  id: string;
  icon: string;
  priority: "critical" | "high" | "medium" | "low";
  timestampMinutesAgo: number;
  messageKey: string;
  actions: AIRecommendationAction[];
};

export type DashboardPendingFollowupItem = {
  id: string;
  estimateNumber: string;
  title: string;
  status: string;
  dueAt: string;
  daysOverdue: number;
  href: string;
};

export type DashboardAutomationQueueItem = {
  runId: string;
  ruleId: string;
  triggerEvent: string;
  startedAt: string;
  status: "running" | "failed";
  relatedEstimateId: string | null;
  relatedProjectId: string | null;
};

export type DashboardRecentAutomationItem = {
  id: string;
  runId: string;
  ruleId: string;
  triggerEvent: string;
  completedAt: string;
  status: "completed" | "failed";
  durationMs: number | null;
  href: string | null;
};

export type DashboardEstimatePipeline = {
  total: number;
  draft: number;
  sent: number;
  viewed: number;
  revisionRequested: number;
  approved: number;
  rejected: number;
};

export type DashboardDecisionItem = {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  summary: string;
  recommendation: string;
  actionLabel: string;
  actionHref: string;
  commandKey: string;
  commandInput: Record<string, unknown>;
  confirmationLevel: "NONE" | "REVIEW" | "REQUIRED";
  hrefFallback: string;
  permissionRequirement: string[];
  unsupportedReason: string | null;
  detectedAt: string;
  status: "new" | "acknowledged" | "resolved" | "dismissed";
};

export type DashboardDecisionHealthItem = {
  id: "sales" | "operations" | "financial" | "scheduling" | "customer" | "overall";
  score: number;
  rating: "Excellent" | "Good" | "Attention" | "Critical";
};

export type DashboardDecisionRiskSummary = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type DashboardMorningBriefing = {
  greeting: string;
  lines: string[];
};

export type DashboardLayoutState = {
  order: WidgetId[];
  hidden: WidgetId[];
  collapsed: WidgetId[];
};

export type DashboardWidgetDefinition = {
  id: WidgetId;
  titleKey: string;
  descriptionKey: string;
};

export type ExecutiveDashboardData = {
  metrics: DashboardMetric[];
  activities: DashboardActivityItem[];
  projectHealth: ProjectHealthSummary;
  schedule: ScheduleEvent[];
  weather: WeatherSnapshot | null;
  businessScore: AIBusinessScoreSnapshot | null;
  businessSummary: BusinessHealthSummary | null;
  recommendations: AIRecommendation[];
  pendingFollowups: DashboardPendingFollowupItem[];
  automationQueue: DashboardAutomationQueueItem[];
  recentAutomations: DashboardRecentAutomationItem[];
  estimatePipeline: DashboardEstimatePipeline;
  topPriorities: DashboardDecisionItem[];
  businessHealth: DashboardDecisionHealthItem[];
  riskSummary: DashboardDecisionRiskSummary;
  decisionRecommendations: DashboardDecisionItem[];
  todaysDecisions: DashboardDecisionItem[];
  criticalAlerts: DashboardDecisionItem[];
  morningBriefing: DashboardMorningBriefing;
  widgetDefinitions: DashboardWidgetDefinition[];
};

export type DashboardSectionId = WidgetId | "weather";

export type DashboardSectionErrors = Partial<Record<DashboardSectionId, string>>;

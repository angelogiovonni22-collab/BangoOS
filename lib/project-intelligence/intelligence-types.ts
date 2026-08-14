/**
 * ProjectIntelligence — structured intelligence object produced by the
 * Project Intelligence Engine. All UI consumers must read from this object
 * instead of querying raw tables independently.
 *
 * This is NOT an AI model. It is a pure data-layer aggregation of project
 * signals computed from already-loaded workspace data.
 */

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type ProjectRiskCategory =
  | "schedule"
  | "budget"
  | "workforce"
  | "quality"
  | "progress";

export type ProjectRisk = {
  /** Stable identifier for deduplication */
  id: string;
  severity: RiskSeverity;
  category: ProjectRiskCategory;
  message: string;
};

// ---------------------------------------------------------------------------
// Sub-intelligence shapes
// ---------------------------------------------------------------------------

export type ProjectSummaryIntelligence = {
  /** 0–100 or null when not enough data */
  healthScore: number | null;
  healthStatus: "on_track" | "at_risk" | "behind" | "complete" | "not_enough_data";
  completionPercent: number;
  /** Unique phase IDs referenced by non-completed tasks */
  activePhasesCount: number;
  /** Tasks not in completed / cancelled status */
  activeTasks: number;
  overdueTasks: number;
  blockedTasks: number;
};

export type ScheduleIntelligence = {
  onSchedule: boolean;
  tasksDueToday: number;
  tasksDueThisWeek: number;
  scheduleRiskLevel: "none" | "low" | "medium" | "high";
  /** Calendar days until project estimated_end_date; null if no date set */
  daysUntilDue: number | null;
};

export type BudgetIntelligence = {
  contractAmount: number | null;
  estimatedCost: number | null;
  /** Sum of invoice.amount_paid */
  invoicePaid: number;
  /** Sum of invoice.total_amount */
  invoiceTotal: number;
  estimatesCount: number;
  changeOrdersCount: number;
  /** contractAmount (or estimatedCost) minus invoicePaid; null if no budget */
  budgetVariance: number | null;
  overdueInvoices: number;
};

export type QualityIntelligence = {
  photosCount: number;
  /** True when project has a non-empty description */
  documentationPresent: boolean;
  taskCompletionTrend: "improving" | "stable" | "unknown";
};

export type WorkforceIntelligence = {
  /** Number of distinct profile IDs assigned to at least one task */
  assignedWorkers: number;
  unassignedTaskCount: number;
  totalTaskCount: number;
  /** profileId → open task count for that worker */
  workloadByProfileId: Record<string, number>;
};

export type RiskIntelligence = {
  risks: ProjectRisk[];
  highestSeverity: RiskSeverity | null;
  totalRisks: number;
};

// ---------------------------------------------------------------------------
// Top-level object
// ---------------------------------------------------------------------------

export type ProjectIntelligence = {
  summary: ProjectSummaryIntelligence;
  schedule: ScheduleIntelligence;
  budget: BudgetIntelligence;
  quality: QualityIntelligence;
  workforce: WorkforceIntelligence;
  risk: RiskIntelligence;
};

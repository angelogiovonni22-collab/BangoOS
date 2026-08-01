/**
 * Project Intelligence Engine — main entry point.
 *
 * Aggregates all project signals from already-loaded workspace data into a
 * single structured ProjectIntelligence object.
 *
 * - No Supabase queries are performed here.
 * - All sub-calculations are delegated to the focused engine modules.
 * - The existing calculateProjectHealth function is reused verbatim.
 */

import { calculateProjectHealth } from "@/components/projects/workspace/project-health-calculator";
import type { ProjectIntelligence, BudgetIntelligence, ProjectSummaryIntelligence } from "./intelligence-types";
import { buildScheduleIntelligence } from "./schedule-engine";
import { buildWorkforceIntelligence } from "./workforce-engine";
import { buildQualityIntelligence } from "./quality-engine";
import { buildRiskIntelligence } from "./risk-engine";

// ---------------------------------------------------------------------------
// Input types — narrow structural types matching the workspace page data
// ---------------------------------------------------------------------------

export type IntelligenceProjectInput = {
  status: string | null;
  estimated_end_date: string | null;
  contract_amount: number | null;
  estimated_cost: number | null;
  description: string | null;
};

export type IntelligenceTaskInput = {
  id: string;
  status: string;
  completion_percentage: number;
  planned_finish: string | null;
  assigned_profile_id: string | null;
  phase_id: string | null;
};

export type IntelligenceInvoiceInput = {
  total_amount: number;
  amount_paid: number;
  due_date: string | null;
};

export type IntelligenceCountsInput = {
  estimates: number;
  changeOrders: number;
  photos: number;
};

export type CalculateProjectIntelligenceInput = {
  project: IntelligenceProjectInput;
  tasks: IntelligenceTaskInput[];
  invoices: IntelligenceInvoiceInput[];
  counts: IntelligenceCountsInput;
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Pure function. Accepts already-loaded workspace data and returns a fully
 * populated ProjectIntelligence object. Safe to call on every render cycle.
 */
export function calculateProjectIntelligence(
  input: CalculateProjectIntelligenceInput,
): ProjectIntelligence {
  const { project, tasks, invoices, counts } = input;
  const todayIso = new Date().toISOString().slice(0, 10);

  // -- Reuse existing health calculator -------------------------------------

  const completionPercent = calcCompletionPercent(tasks);
  const budget = project.contract_amount ?? project.estimated_cost ?? null;
  const invoicePaid = invoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.amount_paid),
    0,
  );

  const health = calculateProjectHealth({
    projectStatus: project.status,
    progressPercent: completionPercent,
    targetCompletionDate: project.estimated_end_date,
    budget,
    spent: invoicePaid,
  });

  // -- Summary ---------------------------------------------------------------

  const nonCompletedTasks = tasks.filter((t) => !isCompletedOrCancelled(t.status));

  const overdueTasks = nonCompletedTasks.filter(
    (t) => t.planned_finish !== null && t.planned_finish < todayIso,
  ).length;

  const blockedTasks = tasks.filter(
    (t) => t.status.trim().toLowerCase() === "blocked",
  ).length;

  const activePhasesCount = new Set(
    nonCompletedTasks
      .map((t) => t.phase_id)
      .filter((id): id is string => id !== null),
  ).size;

  const summary: ProjectSummaryIntelligence = {
    healthScore: health.score,
    healthStatus: health.status,
    completionPercent,
    activePhasesCount,
    activeTasks: nonCompletedTasks.length,
    overdueTasks,
    blockedTasks,
  };

  // -- Schedule --------------------------------------------------------------

  const schedule = buildScheduleIntelligence(
    { estimated_end_date: project.estimated_end_date },
    tasks,
  );

  // -- Budget ----------------------------------------------------------------

  const invoiceTotal = invoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.total_amount),
    0,
  );

  const budgetVariance =
    budget !== null ? budget - invoicePaid : null;

  const overdueInvoices = invoices.filter(
    (inv) =>
      inv.due_date !== null &&
      inv.due_date < todayIso &&
      Math.max(0, inv.total_amount - inv.amount_paid) > 0,
  ).length;

  const budgetIntelligence: BudgetIntelligence = {
    contractAmount: project.contract_amount,
    estimatedCost: project.estimated_cost,
    invoicePaid,
    invoiceTotal,
    estimatesCount: counts.estimates,
    changeOrdersCount: counts.changeOrders,
    budgetVariance,
    overdueInvoices,
  };

  // -- Workforce -------------------------------------------------------------

  const workforce = buildWorkforceIntelligence(tasks);

  // -- Quality ---------------------------------------------------------------

  const quality = buildQualityIntelligence(
    { description: project.description },
    tasks,
    { photos: counts.photos },
  );

  // -- Risk ------------------------------------------------------------------

  const risk = buildRiskIntelligence(project, tasks, invoices, {
    photos: counts.photos,
  });

  return {
    summary,
    schedule,
    budget: budgetIntelligence,
    quality,
    workforce,
    risk,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isCompletedOrCancelled(status: string) {
  const s = status.trim().toLowerCase();
  return s === "completed" || s === "cancelled";
}

function calcCompletionPercent(tasks: IntelligenceTaskInput[]): number {
  if (tasks.length === 0) {
    return 0;
  }

  const total = tasks.reduce((sum, task) => {
    if (task.status.trim().toLowerCase() === "completed") {
      return sum + 100;
    }

    return sum + Math.max(0, Math.min(100, task.completion_percentage));
  }, 0);

  return Math.round(total / tasks.length);
}

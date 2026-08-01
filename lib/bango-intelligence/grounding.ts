/**
 * Grounding layer — converts already-loaded ProjectIntelligence and
 * ProjectSuperintendentBriefing into a compact factual context for the model.
 *
 * The grounding is the ONLY input to the AI provider.
 * No raw database records, no user input, no unverified data reaches the model.
 */

import type { ProjectIntelligence } from "../project-intelligence/intelligence-types";
import type { ProjectSuperintendentBriefing } from "../project-intelligence/briefing/briefing-types";
import type { BriefingGroundingContext } from "./prompts/superintendent-briefing-prompt";

/**
 * Builds a compact, verified grounding context from server-side intelligence
 * and the deterministic briefing.
 *
 * Source IDs in the output can be used by the model to cite data origins.
 */
export function buildGroundingContext(
  projectName: string,
  projectStatus: string,
  intelligence: ProjectIntelligence,
  briefing: ProjectSuperintendentBriefing,
): BriefingGroundingContext {
  const { summary, schedule, budget, quality, workforce, risk } = intelligence;

  return {
    projectName,
    projectStatus,
    briefingDate: briefing.metadata.briefingDate,
    briefingState: briefing.state,
    healthScore: summary.healthScore,
    healthStatus: summary.healthStatus,
    completionPercent: summary.completionPercent,
    activeTasks: summary.activeTasks,
    overdueTasks: summary.overdueTasks,
    blockedTasks: summary.blockedTasks,
    activePhasesCount: summary.activePhasesCount,
    tasksDueToday: schedule.tasksDueToday,
    tasksDueThisWeek: schedule.tasksDueThisWeek,
    daysUntilDue: schedule.daysUntilDue,
    photosCount: quality.photosCount,
    documentationPresent: quality.documentationPresent,
    assignedWorkers: workforce.assignedWorkers,
    unassignedTaskCount: workforce.unassignedTaskCount,
    contractAmount: budget.contractAmount,
    invoicePaid: budget.invoicePaid,
    invoiceTotal: budget.invoiceTotal,
    budgetVariance: budget.budgetVariance,
    overdueInvoices: budget.overdueInvoices,
    estimatesCount: budget.estimatesCount,
    changeOrdersCount: budget.changeOrdersCount,
    highestRisk: risk.highestSeverity,
    // Include only the message (no raw DB data) with a stable source ID
    risks: risk.risks.map((r) => ({
      id: r.id,
      severity: r.severity,
      message: r.message,
    })),
  };
}

/**
 * generate-project-briefing.ts
 *
 * The main entry point for the Superintendent Briefing Engine (Phase 8A).
 *
 * Contract:
 * - Pure function: same input always produces the same output.
 * - No Supabase queries.
 * - No LLM calls.
 * - No invented data.
 * - All content references real values from ProjectIntelligence.
 */

import type { ProjectIntelligence, ProjectRisk } from "../intelligence-types";
import type {
  BriefingFocusItem,
  BriefingGreeting,
  BriefingMetadata,
  BriefingProgressSnapshot,
  BriefingRiskItem,
  BriefingState,
  BriefingTimeOfDay,
  ProjectSuperintendentBriefing,
} from "./briefing-types";
import {
  BRIEFING_FOCUS_KEYS,
  BRIEFING_RISK_FALLBACK,
  BRIEFING_RISK_KEYS,
  BRIEFING_SUMMARY_KEYS,
} from "./briefing-copy";
import { focusPriorityScore, riskPriorityScore } from "./priority-engine";
import { buildRecommendedActions } from "./recommendation-engine";

// ---------------------------------------------------------------------------
// Public input type
// ---------------------------------------------------------------------------

export type GenerateBriefingInput = {
  intelligence: ProjectIntelligence;
  projectId: string;
  projectName: string;
  /** Optional — only provided when already resolved by the workspace layer. */
  userDisplayName?: string | null;
  /** Optional locale tag for date formatting, e.g. "en-US" or "es-ES". */
  localeTag?: string;
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Converts an existing ProjectIntelligence object into a structured
 * ProjectSuperintendentBriefing. This function is deterministic and testable.
 */
export function generateProjectBriefing(
  input: GenerateBriefingInput,
): ProjectSuperintendentBriefing {
  const { intelligence, projectId, projectName, userDisplayName = null, localeTag = "en-US" } = input;
  const { summary, schedule, budget, quality, workforce, risk } = intelligence;

  const now = new Date();
  const briefingDate = now.toISOString().slice(0, 10);

  // -- State ----------------------------------------------------------------

  const state = deriveBriefingState(intelligence);

  // -- Metadata -------------------------------------------------------------

  const metadata: BriefingMetadata = {
    projectId,
    generatedAt: now.toISOString(),
    briefingDate,
    healthScore: summary.healthScore,
    healthStatus: summary.healthStatus,
    highestRiskSeverity: risk.highestSeverity,
  };

  // -- Greeting -------------------------------------------------------------

  const greeting: BriefingGreeting = {
    timeOfDay: deriveTimeOfDay(now),
    projectName,
    userDisplayName: userDisplayName ?? null,
    dateLabel: formatDateLabel(now, localeTag),
  };

  // -- Executive summary key ------------------------------------------------

  const executiveSummaryKey = BRIEFING_SUMMARY_KEYS[state];
  const executiveSummaryParams: Record<string, string | number> = {
    project: projectName,
    healthScore: summary.healthScore ?? 0,
    overdueTasks: summary.overdueTasks,
    blockedTasks: summary.blockedTasks,
    completion: summary.completionPercent,
  };

  // -- Focus items ----------------------------------------------------------

  const focusItems = buildFocusItems(intelligence).slice(0, 5);

  // -- Risk items -----------------------------------------------------------

  const riskItems = buildRiskItems(risk.risks).slice(0, 5);

  // -- Progress snapshot ----------------------------------------------------

  const progressSnapshot: BriefingProgressSnapshot = {
    healthScore: summary.healthScore,
    completionPercent: summary.completionPercent,
    activeTasks: summary.activeTasks,
    overdueTasks: summary.overdueTasks,
    blockedTasks: summary.blockedTasks,
    activePhasesCount: summary.activePhasesCount,
    tasksDueToday: schedule.tasksDueToday,
    tasksDueThisWeek: schedule.tasksDueThisWeek,
    photosCount: quality.photosCount,
    assignedWorkers: workforce.assignedWorkers,
    unassignedTaskCount: workforce.unassignedTaskCount,
    invoiceTotal: budget.invoiceTotal,
    invoicePaid: budget.invoicePaid,
    changeOrderCount: budget.changeOrdersCount,
  };

  // -- Recommended actions --------------------------------------------------

  const recommendedActions = buildRecommendedActions(risk.risks, state);

  return {
    metadata,
    state,
    greeting,
    executiveSummaryKey,
    executiveSummaryParams,
    focusItems,
    riskItems,
    progressSnapshot,
    recommendedActions,
  };
}

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

function deriveBriefingState(intelligence: ProjectIntelligence): BriefingState {
  const { summary, risk, workforce } = intelligence;

  // No tasks at all → no active work state
  if (workforce.totalTaskCount === 0) {
    return "no_active_work";
  }

  // Health engine says not enough data
  if (summary.healthStatus === "not_enough_data") {
    return "limited_data";
  }

  // Critical risk present
  if (risk.highestSeverity === "critical") {
    return "critical";
  }

  // High or medium risk present
  if (risk.highestSeverity === "high" || risk.highestSeverity === "medium") {
    return "attention";
  }

  // Only low risks or none → healthy
  return "healthy";
}

// ---------------------------------------------------------------------------
// Focus item builders
// ---------------------------------------------------------------------------

function buildFocusItems(intelligence: ProjectIntelligence): BriefingFocusItem[] {
  const { summary, schedule, budget, quality } = intelligence;
  const items: BriefingFocusItem[] = [];

  // Overdue tasks
  if (summary.overdueTasks > 0) {
    const urgency = summary.overdueTasks >= 5 ? "critical" : summary.overdueTasks >= 2 ? "high" : "medium";
    items.push({
      id: "focus_overdue",
      priority: focusPriorityScore(urgency, summary.overdueTasks, "schedule"),
      titleKey: BRIEFING_FOCUS_KEYS.overdueTasks.title,
      descriptionKey: BRIEFING_FOCUS_KEYS.overdueTasks.description,
      params: { count: summary.overdueTasks },
      urgency,
    });
  }

  // Blocked tasks
  if (summary.blockedTasks > 0) {
    const urgency = summary.blockedTasks >= 3 ? "high" : "medium";
    items.push({
      id: "focus_blocked",
      priority: focusPriorityScore(urgency, summary.blockedTasks, "progress"),
      titleKey: BRIEFING_FOCUS_KEYS.blockedTasks.title,
      descriptionKey: BRIEFING_FOCUS_KEYS.blockedTasks.description,
      params: { count: summary.blockedTasks },
      urgency,
    });
  }

  // Tasks due today
  if (schedule.tasksDueToday > 0) {
    items.push({
      id: "focus_due_today",
      priority: focusPriorityScore("high", schedule.tasksDueToday, "schedule"),
      titleKey: BRIEFING_FOCUS_KEYS.tasksDueToday.title,
      descriptionKey: BRIEFING_FOCUS_KEYS.tasksDueToday.description,
      params: { count: schedule.tasksDueToday },
      urgency: "high",
    });
  }

  // Overdue invoices
  if (budget.overdueInvoices > 0) {
    const urgency = budget.overdueInvoices >= 2 ? "high" : "medium";
    items.push({
      id: "focus_overdue_invoices",
      priority: focusPriorityScore(urgency, budget.overdueInvoices, "budget"),
      titleKey: BRIEFING_FOCUS_KEYS.overdueInvoices.title,
      descriptionKey: BRIEFING_FOCUS_KEYS.overdueInvoices.description,
      params: { count: budget.overdueInvoices },
      urgency,
    });
  }

  // Unassigned open tasks
  if (intelligence.workforce.unassignedTaskCount > 0) {
    const urgency = intelligence.workforce.unassignedTaskCount >= 5 ? "high" : "medium";
    items.push({
      id: "focus_unassigned",
      priority: focusPriorityScore(urgency, intelligence.workforce.unassignedTaskCount, "workforce"),
      titleKey: BRIEFING_FOCUS_KEYS.unassignedTasks.title,
      descriptionKey: BRIEFING_FOCUS_KEYS.unassignedTasks.description,
      params: { count: intelligence.workforce.unassignedTaskCount },
      urgency,
    });
  }

  // Near budget
  const budgetBase = intelligence.budget.contractAmount ?? intelligence.budget.estimatedCost;
  if (budgetBase !== null && budgetBase > 0) {
    const ratio = intelligence.budget.invoicePaid / budgetBase;
    if (ratio >= 0.85) {
      const urgency = ratio > 1 ? "critical" : "high";
      items.push({
        id: "focus_near_budget",
        priority: focusPriorityScore(urgency, null, "budget"),
        titleKey: BRIEFING_FOCUS_KEYS.nearBudget.title,
        descriptionKey: BRIEFING_FOCUS_KEYS.nearBudget.description,
        params: { percent: Math.round(ratio * 100) },
        urgency,
      });
    }
  }

  // No target date
  if (!hasTargetDate(intelligence)) {
    items.push({
      id: "focus_no_target_date",
      priority: focusPriorityScore("low", null, "setup"),
      titleKey: BRIEFING_FOCUS_KEYS.noTargetDate.title,
      descriptionKey: BRIEFING_FOCUS_KEYS.noTargetDate.description,
      params: {},
      urgency: "low",
    });
  }

  // No description
  if (!quality.documentationPresent) {
    items.push({
      id: "focus_no_description",
      priority: focusPriorityScore("low", null, "quality"),
      titleKey: BRIEFING_FOCUS_KEYS.noDescription.title,
      descriptionKey: BRIEFING_FOCUS_KEYS.noDescription.description,
      params: {},
      urgency: "low",
    });
  }

  // No photos (only surface if tasks exist, so user isn't alarmed before project starts)
  if (quality.photosCount === 0 && intelligence.workforce.totalTaskCount > 0) {
    items.push({
      id: "focus_no_photos",
      priority: focusPriorityScore("low", null, "quality"),
      titleKey: BRIEFING_FOCUS_KEYS.noPhotos.title,
      descriptionKey: BRIEFING_FOCUS_KEYS.noPhotos.description,
      params: {},
      urgency: "info",
    });
  }

  // Tasks due this week (only if no due-today items already cover it)
  if (schedule.tasksDueThisWeek > 0 && schedule.tasksDueToday === 0) {
    items.push({
      id: "focus_due_this_week",
      priority: focusPriorityScore("medium", schedule.tasksDueThisWeek, "schedule"),
      titleKey: BRIEFING_FOCUS_KEYS.tasksDueThisWeek.title,
      descriptionKey: BRIEFING_FOCUS_KEYS.tasksDueThisWeek.description,
      params: { count: schedule.tasksDueThisWeek },
      urgency: "medium",
    });
  }

  items.sort((a, b) => a.priority - b.priority);
  return items;
}

// ---------------------------------------------------------------------------
// Risk item builders
// ---------------------------------------------------------------------------

function buildRiskItems(risks: ProjectRisk[]): BriefingRiskItem[] {
  return risks
    .map((risk) => {
      const keys = BRIEFING_RISK_KEYS[risk.id] ?? BRIEFING_RISK_FALLBACK;
      const count = extractCountFromMessage(risk.message);
      const params: Record<string, string | number> = count !== null ? { count } : {};
      return {
        riskId: risk.id,
        severity: risk.severity,
        titleKey: keys.title,
        explanationKey: keys.explanation,
        params,
        recommendedResponseKey: keys.response,
        sourceCategory: risk.category,
        sortPriority: riskPriorityScore(risk.severity, count, risk.category),
      } satisfies BriefingRiskItem;
    })
    .sort((a, b) => a.sortPriority - b.sortPriority);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveTimeOfDay(now: Date): BriefingTimeOfDay {
  const hour = now.getHours();
  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  return "evening";
}

function formatDateLabel(now: Date, localeTag: string): string {
  try {
    return now.toLocaleDateString(localeTag, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function hasTargetDate(intelligence: ProjectIntelligence): boolean {
  return intelligence.schedule.daysUntilDue !== null;
}

/**
 * Extracts the leading integer from a risk message, e.g.
 * "5 tasks are past their planned finish date." → 5
 */
function extractCountFromMessage(message: string): number | null {
  const match = /^(\d+)/.exec(message);
  if (!match) {
    return null;
  }

  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

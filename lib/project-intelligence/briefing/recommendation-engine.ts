/**
 * Recommendation Engine — maps ProjectRisk signals to BriefingActions.
 *
 * Rules:
 * - Each rule maps one or more risk IDs to a single stable action ID.
 * - When multiple risks map to the same action, the action is emitted once
 *   (deduplication) using the highest-severity risk as the source.
 * - Only actions justifiable from real project data are emitted.
 * - Maximum 5 actions are returned, sorted by priority score.
 * - A "continue normal execution" info action is appended when no meaningful
 *   risks exist and the project is healthy.
 */

import type { ProjectRisk, RiskSeverity } from "../intelligence-types";
import type { BriefingAction, BriefingActionCategory } from "./briefing-types";
import { actionPriorityScore } from "./priority-engine";

// ---------------------------------------------------------------------------
// Rule table
// ---------------------------------------------------------------------------

type ActionRule = {
  /** Stable action ID — must never change across re-renders */
  actionId: string;
  /** Risk IDs that trigger this action */
  triggerRiskIds: string[];
  titleKey: string;
  explanationKey: string;
  category: BriefingActionCategory;
  /** Existing app route, or null */
  href: string | null;
  isActionable: boolean;
};

const ACTION_RULES: ActionRule[] = [
  // Schedule rules
  {
    actionId: "action_review_overdue",
    triggerRiskIds: [
      "risk_overdue_critical",
      "risk_overdue_high",
      "risk_overdue_medium",
    ],
    titleKey: "briefingActionReviewOverdueTitle",
    explanationKey: "briefingActionReviewOverdueExplanation",
    category: "schedule",
    href: null,
    isActionable: true,
  },
  {
    actionId: "action_define_target_date",
    triggerRiskIds: ["risk_no_target_date"],
    titleKey: "briefingActionDefineTargetDateTitle",
    explanationKey: "briefingActionDefineTargetDateExplanation",
    category: "setup",
    href: null,
    isActionable: true,
  },

  // Progress / blocked rules
  {
    actionId: "action_resolve_blocked",
    triggerRiskIds: ["risk_blocked_high", "risk_blocked_medium"],
    titleKey: "briefingActionResolveBlockedTitle",
    explanationKey: "briefingActionResolveBlockedExplanation",
    category: "progress",
    href: null,
    isActionable: true,
  },

  // Workforce rules
  {
    actionId: "action_assign_tasks",
    triggerRiskIds: [
      "risk_unassigned_high",
      "risk_unassigned_medium",
      "risk_unassigned_low",
    ],
    titleKey: "briefingActionAssignTasksTitle",
    explanationKey: "briefingActionAssignTasksExplanation",
    category: "workforce",
    href: null,
    isActionable: true,
  },

  // Budget rules
  {
    actionId: "action_review_invoices",
    triggerRiskIds: [
      "risk_invoice_overdue_high",
      "risk_invoice_overdue_medium",
    ],
    titleKey: "briefingActionReviewInvoicesTitle",
    explanationKey: "briefingActionReviewInvoicesExplanation",
    category: "budget",
    href: "/invoices",
    isActionable: true,
  },
  {
    actionId: "action_review_budget",
    triggerRiskIds: ["risk_over_budget", "risk_near_budget", "risk_no_budget"],
    titleKey: "briefingActionReviewBudgetTitle",
    explanationKey: "briefingActionReviewBudgetExplanation",
    category: "budget",
    href: null,
    isActionable: true,
  },

  // Quality / setup rules
  {
    actionId: "action_add_description",
    triggerRiskIds: ["risk_no_description"],
    titleKey: "briefingActionAddDescriptionTitle",
    explanationKey: "briefingActionAddDescriptionExplanation",
    category: "setup",
    href: null,
    isActionable: true,
  },
  {
    actionId: "action_upload_photos",
    triggerRiskIds: ["risk_no_photos"],
    titleKey: "briefingActionUploadPhotosTitle",
    explanationKey: "briefingActionUploadPhotosExplanation",
    category: "quality",
    href: null,
    isActionable: true,
  },
];

/** Stable action for healthy projects with no meaningful risks */
const HEALTHY_ACTION: BriefingAction = {
  id: "action_continue_execution",
  titleKey: "briefingActionContinueTitle",
  explanationKey: "briefingActionContinueExplanation",
  priority: 999,
  sourceRiskId: null,
  category: "continue",
  href: null,
  isActionable: false,
};

// ---------------------------------------------------------------------------
// Severity ordering for deduplication
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: RiskSeverity[] = ["low", "medium", "high", "critical"];

function highestSeverity(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

export function buildRecommendedActions(
  risks: ProjectRisk[],
  state: "healthy" | "attention" | "critical" | "limited_data" | "no_active_work",
): BriefingAction[] {
  const riskById = new Map(risks.map((r) => [r.id, r]));

  // Map: actionId → { rule, sourceRisk (highest severity) }
  const triggered = new Map<
    string,
    { rule: ActionRule; sourceSeverity: RiskSeverity; sourceRiskId: string }
  >();

  for (const rule of ACTION_RULES) {
    for (const triggerRiskId of rule.triggerRiskIds) {
      const risk = riskById.get(triggerRiskId);
      if (!risk) {
        continue;
      }

      const existing = triggered.get(rule.actionId);
      if (!existing) {
        triggered.set(rule.actionId, {
          rule,
          sourceSeverity: risk.severity,
          sourceRiskId: risk.id,
        });
      } else {
        // Keep the highest severity source
        const merged = highestSeverity(existing.sourceSeverity, risk.severity);
        triggered.set(rule.actionId, {
          rule,
          sourceSeverity: merged,
          sourceRiskId:
            merged === risk.severity ? risk.id : existing.sourceRiskId,
        });
      }
    }
  }

  const actions: BriefingAction[] = Array.from(triggered.values()).map(
    ({ rule, sourceSeverity, sourceRiskId }) => ({
      id: rule.actionId,
      titleKey: rule.titleKey,
      explanationKey: rule.explanationKey,
      priority: actionPriorityScore(sourceSeverity, rule.category),
      sourceRiskId,
      category: rule.category,
      href: rule.href,
      isActionable: rule.isActionable,
    }),
  );

  actions.sort((a, b) => a.priority - b.priority);

  const top = actions.slice(0, 5);

  // For healthy projects with no actions, add the info action
  if (top.length === 0 && (state === "healthy" || state === "no_active_work")) {
    return [HEALTHY_ACTION];
  }

  return top;
}

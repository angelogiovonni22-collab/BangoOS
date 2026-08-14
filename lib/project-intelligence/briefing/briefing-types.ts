/**
 * Briefing types for the AI Project Superintendent Briefing Engine (Phase 8A).
 *
 * This module is deterministic and rule-based. It does not call any LLM or
 * external service. All values are derived from the existing ProjectIntelligence
 * object. The output is structured for later consumption by Phase 8B (LLM),
 * but this phase is complete and testable without any LLM.
 */

import type { RiskSeverity } from "../intelligence-types";

// ---------------------------------------------------------------------------
// Briefing state
// ---------------------------------------------------------------------------

/** Overall disposition of the briefing based on risk and data availability. */
export type BriefingState =
  | "healthy"       // no high/critical risks, project progressing normally
  | "attention"     // medium or high risks present
  | "critical"      // at least one critical risk
  | "limited_data"  // insufficient data to assess meaningfully
  | "no_active_work"; // zero total tasks

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export type BriefingMetadata = {
  projectId: string;
  generatedAt: string;        // ISO timestamp
  briefingDate: string;       // YYYY-MM-DD
  healthScore: number | null;
  healthStatus: string;
  highestRiskSeverity: RiskSeverity | null;
};

// ---------------------------------------------------------------------------
// Greeting
// ---------------------------------------------------------------------------

export type BriefingTimeOfDay = "morning" | "afternoon" | "evening";

export type BriefingGreeting = {
  timeOfDay: BriefingTimeOfDay;
  projectName: string;
  /** Null when the caller has not provided a display name. Never hardcoded. */
  userDisplayName: string | null;
  /** Human-readable date label, e.g. "Thursday, July 31" */
  dateLabel: string;
};

// ---------------------------------------------------------------------------
// Focus items
// ---------------------------------------------------------------------------

export type BriefingFocusUrgency = "critical" | "high" | "medium" | "low" | "info";

export type BriefingFocusItem = {
  id: string;
  /** Lower number = shown first */
  priority: number;
  /** i18n key in the projects namespace */
  titleKey: string;
  /** i18n key in the projects namespace */
  descriptionKey: string;
  /** Interpolation params for the i18n template */
  params: Record<string, string | number>;
  urgency: BriefingFocusUrgency;
};

// ---------------------------------------------------------------------------
// Risk items (derived from ProjectRisk)
// ---------------------------------------------------------------------------

export type BriefingRiskItem = {
  riskId: string;
  severity: RiskSeverity;
  titleKey: string;
  explanationKey: string;
  params: Record<string, string | number>;
  recommendedResponseKey: string;
  sourceCategory: string;
  /** Lower = shown first */
  sortPriority: number;
};

// ---------------------------------------------------------------------------
// Progress snapshot
// ---------------------------------------------------------------------------

export type BriefingProgressSnapshot = {
  healthScore: number | null;
  completionPercent: number;
  activeTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  activePhasesCount: number;
  tasksDueToday: number;
  tasksDueThisWeek: number;
  photosCount: number;
  assignedWorkers: number;
  unassignedTaskCount: number;
  invoiceTotal: number;
  invoicePaid: number;
  changeOrderCount: number;
};

// ---------------------------------------------------------------------------
// Recommended actions
// ---------------------------------------------------------------------------

export type BriefingActionCategory =
  | "schedule"
  | "budget"
  | "workforce"
  | "quality"
  | "progress"
  | "setup"
  | "continue";

export type BriefingAction = {
  id: string;
  titleKey: string;
  explanationKey: string;
  /** Lower = shown first */
  priority: number;
  /** Stable ID of the source ProjectRisk when applicable */
  sourceRiskId: string | null;
  category: BriefingActionCategory;
  /** Existing workspace route, or null when no route is supported */
  href: string | null;
  /** False = informational only; True = user can take direct action */
  isActionable: boolean;
};

// ---------------------------------------------------------------------------
// Top-level briefing object
// ---------------------------------------------------------------------------

export type ProjectSuperintendentBriefing = {
  metadata: BriefingMetadata;
  state: BriefingState;
  greeting: BriefingGreeting;
  /** i18n key for the executive summary */
  executiveSummaryKey: string;
  /** Interpolation params for the executive-summary template */
  executiveSummaryParams: Record<string, string | number>;
  /** Up to 5 prioritized focus items */
  focusItems: BriefingFocusItem[];
  /** Up to 5 risk items sorted by severity */
  riskItems: BriefingRiskItem[];
  progressSnapshot: BriefingProgressSnapshot;
  /** Up to 5 recommended actions */
  recommendedActions: BriefingAction[];
};

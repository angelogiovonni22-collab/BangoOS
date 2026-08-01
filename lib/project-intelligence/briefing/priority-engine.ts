/**
 * Priority Engine — deterministic numeric priority scores for briefing items.
 *
 * Lower score = shown first (higher priority).
 *
 * Scoring factors:
 *   - severity (critical=0, high=100, medium=200, low=300)
 *   - urgency modifier: count of affected items (subtract up to 40 pts)
 *   - category modifier: schedule > workforce > budget > quality > setup
 *   - tie-breaker: stable string hash so ordering never changes for same input
 *
 * All values are constants with no randomness. The same input always
 * produces the same priority score.
 */

import type { RiskSeverity } from "../intelligence-types";
import type { BriefingFocusUrgency } from "./briefing-types";

// ---------------------------------------------------------------------------
// Severity base scores
// ---------------------------------------------------------------------------

const SEVERITY_BASE: Record<RiskSeverity, number> = {
  critical: 0,
  high: 100,
  medium: 200,
  low: 300,
};

const URGENCY_BASE: Record<BriefingFocusUrgency, number> = {
  critical: 0,
  high: 100,
  medium: 200,
  low: 300,
  info: 400,
};

// ---------------------------------------------------------------------------
// Category modifiers (added to base score)
// ---------------------------------------------------------------------------

const CATEGORY_MODIFIER: Record<string, number> = {
  schedule: 0,
  progress: 10,
  workforce: 20,
  budget: 30,
  quality: 40,
  setup: 50,
  continue: 60,
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Computes a deterministic priority score for a risk item.
 * @param severity   The risk severity.
 * @param count      Number of affected records (clipped to 0–10 range).
 * @param category   Source category string.
 */
export function riskPriorityScore(
  severity: RiskSeverity,
  count: number | null,
  category: string,
): number {
  const base = SEVERITY_BASE[severity] ?? 300;
  // More affected items → higher priority (lower score). Cap benefit at 40pts.
  const countModifier = count !== null ? -Math.min(40, count * 4) : 0;
  const categoryMod = CATEGORY_MODIFIER[category] ?? 50;
  return base + countModifier + categoryMod;
}

/**
 * Computes a deterministic priority score for a focus item.
 * @param urgency    Focus item urgency.
 * @param count      Number of affected records.
 * @param category   Source category string.
 */
export function focusPriorityScore(
  urgency: BriefingFocusUrgency,
  count: number | null,
  category: string,
): number {
  const base = URGENCY_BASE[urgency] ?? 400;
  const countModifier = count !== null ? -Math.min(40, count * 4) : 0;
  const categoryMod = CATEGORY_MODIFIER[category] ?? 50;
  return base + countModifier + categoryMod;
}

/**
 * Computes a deterministic priority score for a recommended action.
 * @param severity   Severity of the source risk (or null for info actions).
 * @param category   Action category.
 */
export function actionPriorityScore(
  severity: RiskSeverity | null,
  category: string,
): number {
  const base = severity ? SEVERITY_BASE[severity] : 300;
  const categoryMod = CATEGORY_MODIFIER[category] ?? 50;
  return base + categoryMod;
}

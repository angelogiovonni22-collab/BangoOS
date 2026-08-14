/**
 * Response validation — validates and sanitizes the raw JSON string returned
 * by the AI provider.
 *
 * If validation fails, the caller should fall back to the deterministic briefing.
 * No malformed or partially-valid AI output is returned to the UI.
 */

import type {
  NarratedBriefing,
  NarratedFocusItem,
  NarratedRisk,
  NarratedAction,
} from "./types";

const VALID_PRIORITIES = ["critical", "high", "medium", "low", "info"] as const;
const VALID_SEVERITIES = ["critical", "high", "medium", "low"] as const;
const VALID_CONFIDENCES = ["high", "medium", "low"] as const;

/**
 * Parses the raw JSON from the model and validates it against the
 * NarratedBriefing schema.
 *
 * Returns the validated object, or null on failure.
 */
export function validateNarratedBriefing(raw: string): NarratedBriefing | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  if (!isNonEmptyString(obj.headline)) {
    return null;
  }

  if (!isNonEmptyString(obj.executive_summary)) {
    return null;
  }

  if (!isValidConfidence(obj.confidence)) {
    return null;
  }

  const today_focus = validateFocusItems(obj.today_focus);
  if (today_focus === null) {
    return null;
  }

  const risks = validateRisks(obj.risks);
  if (risks === null) {
    return null;
  }

  const recommended_actions = validateActions(obj.recommended_actions);
  if (recommended_actions === null) {
    return null;
  }

  const limitations = validateStringArray(obj.limitations);
  if (limitations === null) {
    return null;
  }

  return {
    headline: String(obj.headline).trim().slice(0, 200),
    executive_summary: String(obj.executive_summary).trim().slice(0, 1000),
    today_focus: today_focus.slice(0, 5),
    risks: risks.slice(0, 5),
    recommended_actions: recommended_actions.slice(0, 5),
    confidence: obj.confidence as NarratedBriefing["confidence"],
    limitations: limitations.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidConfidence(value: unknown): boolean {
  return typeof value === "string" && VALID_CONFIDENCES.includes(value as NarratedBriefing["confidence"]);
}

function validateStringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }

    result.push(item.trim().slice(0, 500));
  }

  return result;
}

function validateSourceIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((v) => typeof v === "string").slice(0, 10).map((v) => String(v).slice(0, 100));
}

function validateFocusItems(value: unknown): NarratedFocusItem[] | null {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const result: NarratedFocusItem[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const obj = item as Record<string, unknown>;
    if (!isNonEmptyString(obj.title) || !isNonEmptyString(obj.explanation)) {
      return null;
    }

    if (!VALID_PRIORITIES.includes(obj.priority as NarratedFocusItem["priority"])) {
      return null;
    }

    result.push({
      title: String(obj.title).trim().slice(0, 200),
      explanation: String(obj.explanation).trim().slice(0, 500),
      priority: obj.priority as NarratedFocusItem["priority"],
      source_ids: validateSourceIds(obj.source_ids),
    });
  }

  return result;
}

function validateRisks(value: unknown): NarratedRisk[] | null {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const result: NarratedRisk[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const obj = item as Record<string, unknown>;
    if (!isNonEmptyString(obj.title) || !isNonEmptyString(obj.explanation)) {
      return null;
    }

    if (!VALID_SEVERITIES.includes(obj.severity as NarratedRisk["severity"])) {
      return null;
    }

    result.push({
      title: String(obj.title).trim().slice(0, 200),
      explanation: String(obj.explanation).trim().slice(0, 500),
      severity: obj.severity as NarratedRisk["severity"],
      source_ids: validateSourceIds(obj.source_ids),
    });
  }

  return result;
}

function validateActions(value: unknown): NarratedAction[] | null {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const result: NarratedAction[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const obj = item as Record<string, unknown>;
    if (!isNonEmptyString(obj.title) || !isNonEmptyString(obj.explanation)) {
      return null;
    }

    if (!VALID_PRIORITIES.includes(obj.priority as NarratedAction["priority"])) {
      return null;
    }

    result.push({
      title: String(obj.title).trim().slice(0, 200),
      explanation: String(obj.explanation).trim().slice(0, 500),
      priority: obj.priority as NarratedAction["priority"],
      source_ids: validateSourceIds(obj.source_ids),
      requires_approval: obj.requires_approval === true,
    });
  }

  return result;
}

import {
  ORION_DECISION_CATEGORIES,
  ORION_DECISION_PRIORITIES,
  ORION_DECISION_SEVERITIES,
  ORION_DECISION_STATUSES,
  type OrionDecisionRecord,
  type OrionDecisionRule,
} from "./decision-types";

export type OrionDecisionValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateDecisionRule(rule: OrionDecisionRule): OrionDecisionValidationResult {
  const errors: string[] = [];

  if (!rule.id.trim()) {
    errors.push("rule id is required");
  }

  if (!ORION_DECISION_CATEGORIES.includes(rule.category)) {
    errors.push("rule category is invalid");
  }

  if (typeof rule.evaluate !== "function") {
    errors.push("rule evaluate function is required");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

export function validateDecisionRecord(decision: OrionDecisionRecord): OrionDecisionValidationResult {
  const errors: string[] = [];

  if (!decision.decisionId.trim()) {
    errors.push("decisionId is required");
  }

  if (!decision.companyId.trim()) {
    errors.push("companyId is required");
  }

  if (!decision.ruleId.trim()) {
    errors.push("ruleId is required");
  }

  if (!ORION_DECISION_PRIORITIES.includes(decision.priority)) {
    errors.push("priority is invalid");
  }

  if (!ORION_DECISION_CATEGORIES.includes(decision.category)) {
    errors.push("category is invalid");
  }

  if (!ORION_DECISION_SEVERITIES.includes(decision.severity)) {
    errors.push("severity is invalid");
  }

  if (!ORION_DECISION_STATUSES.includes(decision.status)) {
    errors.push("status is invalid");
  }

  if (!decision.relatedEntity.href.startsWith("/")) {
    errors.push("action href must be a relative app route");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

export function canTransitionDecisionStatus(from: OrionDecisionRecord["status"], to: OrionDecisionRecord["status"]) {
  if (from === to) {
    return true;
  }

  if (from === "new") {
    return to === "acknowledged" || to === "resolved" || to === "dismissed";
  }

  if (from === "acknowledged") {
    return to === "resolved" || to === "dismissed";
  }

  return false;
}

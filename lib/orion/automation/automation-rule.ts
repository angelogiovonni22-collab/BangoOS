import type { OrionAutomationRule } from "./automation-types";

export function defineAutomationRule(rule: OrionAutomationRule): OrionAutomationRule {
  return rule;
}

export function byDescendingPriority(left: OrionAutomationRule, right: OrionAutomationRule) {
  if (left.priority === right.priority) {
    return left.id.localeCompare(right.id);
  }

  return right.priority - left.priority;
}

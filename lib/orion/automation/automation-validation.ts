import type { OrionEventRecord } from "@/lib/orion/events";
import {
  ORION_AUTOMATION_TRIGGER_EVENTS,
  type OrionAutomationRule,
} from "./automation-types";

export type OrionAutomationValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateAutomationRule(rule: OrionAutomationRule): OrionAutomationValidationResult {
  const errors: string[] = [];

  if (!rule.id.trim()) {
    errors.push("Rule id is required.");
  }

  if (!rule.companyId.trim()) {
    errors.push("Rule companyId is required.");
  }

  if (!ORION_AUTOMATION_TRIGGER_EVENTS.includes(rule.triggerEvent)) {
    errors.push("Trigger event is not supported.");
  }

  if (!Number.isInteger(rule.priority)) {
    errors.push("Rule priority must be an integer.");
  }

  if (rule.actions.length === 0) {
    errors.push("Rule must include at least one action.");
  }

  const actionIds = new Set<string>();
  for (const action of rule.actions) {
    if (!action.id.trim()) {
      errors.push("Rule action id is required.");
      continue;
    }

    if (actionIds.has(action.id)) {
      errors.push(`Duplicate action id: ${action.id}`);
      continue;
    }

    actionIds.add(action.id);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

export function supportsAutomationTrigger(event: OrionEventRecord) {
  return ORION_AUTOMATION_TRIGGER_EVENTS.includes(event.event_type as (typeof ORION_AUTOMATION_TRIGGER_EVENTS)[number]);
}

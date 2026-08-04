import { ORION_AGGREGATE_TYPES, ORION_EVENT_TYPES, ORION_SOURCE_MODULES } from "./event-types";
import type { OrionEventInput } from "./event-contracts";

export type OrionEventValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

function isIsoTimestamp(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export function validateOrionEventInput(input: OrionEventInput): OrionEventValidationResult {
  const errors: string[] = [];

  if (!input.company_id?.trim()) {
    errors.push("company_id is required.");
  }

  if (!input.aggregate_id?.trim()) {
    errors.push("aggregate_id is required.");
  }

  if (!ORION_EVENT_TYPES.includes(input.event_type)) {
    errors.push("event_type is not supported.");
  }

  if (!ORION_AGGREGATE_TYPES.includes(input.aggregate_type)) {
    errors.push("aggregate_type is not supported.");
  }

  if (!ORION_SOURCE_MODULES.includes(input.source_module)) {
    errors.push("source_module is not supported.");
  }

  const version = input.version ?? 1;
  if (!Number.isInteger(version) || version < 1) {
    errors.push("version must be an integer greater than zero.");
  }

  if (input.occurred_at && !isIsoTimestamp(input.occurred_at)) {
    errors.push("occurred_at must be an ISO timestamp.");
  }

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    errors.push("payload must be an object.");
  }

  const idempotencyKey = input.idempotency_key?.trim() || "";
  if (idempotencyKey.length > 0 && idempotencyKey.length > 200) {
    errors.push("idempotency_key must be 200 characters or fewer.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

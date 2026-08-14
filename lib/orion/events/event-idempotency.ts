import type { OrionEventInput } from "./event-contracts";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

export function normalizeIdempotencyKey(value: string | undefined) {
  const normalized = value?.trim() || "";
  return normalized.length > 0 ? normalized : null;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function computeDefaultIdempotencyKey(input: OrionEventInput) {
  const digest = hashString([
    input.company_id,
    input.event_type,
    input.aggregate_type,
    input.aggregate_id,
    input.actor_profile_id || "",
    input.correlation_id || "",
    stableJson(input.payload),
  ].join("|"));

  return `orion:${digest}`;
}

export function resolveEventId(explicitEventId?: string) {
  const value = explicitEventId?.trim() || "";

  if (value) {
    return value;
  }

  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `orion-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

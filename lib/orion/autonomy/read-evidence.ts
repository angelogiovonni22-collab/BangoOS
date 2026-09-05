import type { OrionCommandExecutionResult } from "@/lib/orion/commands/types";

const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;
const MAX_STRING_LENGTH = 1500;
const MAX_SERIALIZED_BYTES = 8_000;
const SENSITIVE_KEY = /(?:password|passwd|secret|token|authorization|cookie|api[_-]?key|credential|private[_-]?key)/i;

export type OrionReadEvidence = {
  entityType: OrionCommandExecutionResult["entityType"];
  entityId: string | null;
  details: unknown;
  truncated: boolean;
};

type SanitizeState = { truncated: boolean };

function sanitize(value: unknown, state: SanitizeState, depth: number): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (value.length <= MAX_STRING_LENGTH) return value;
    state.truncated = true;
    return `${value.slice(0, MAX_STRING_LENGTH)}…`;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return null;
  if (depth >= MAX_DEPTH) {
    state.truncated = true;
    return "[truncated]";
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) state.truncated = true;
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, state, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_OBJECT_KEYS) state.truncated = true;
    const safe: Record<string, unknown> = {};
    for (const [key, item] of entries.slice(0, MAX_OBJECT_KEYS)) {
      if (SENSITIVE_KEY.test(key)) {
        state.truncated = true;
        continue;
      }
      safe[key] = sanitize(item, state, depth + 1);
    }
    return safe;
  }
  return null;
}

export function buildOrionReadEvidence(result: OrionCommandExecutionResult): OrionReadEvidence {
  const state: SanitizeState = { truncated: false };
  let details = sanitize(result.details, state, 0);

  const serialized = JSON.stringify(details);
  if (Buffer.byteLength(serialized, "utf8") > MAX_SERIALIZED_BYTES) {
    state.truncated = true;
    details = {
      truncated: true,
      note: "Verified BOS read details exceeded the Realtime evidence budget. Use a narrower follow-up read for more detail.",
    };
  }

  return {
    entityType: result.entityType,
    entityId: result.entityId,
    details,
    truncated: state.truncated,
  };
}

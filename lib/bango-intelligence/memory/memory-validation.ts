import type { MemoryCreateInput, MemoryJson, MemoryUpdateInput } from "./memory-types";
import { validateSourceReferences } from "./memory-source-validation";

const MAX_TITLE_LENGTH = 180;
const MAX_SUMMARY_LENGTH = 1000;
const MAX_TAG_COUNT = 24;
const MAX_TAG_LENGTH = 40;
const MAX_JSON_BYTES = 8192;
const FORBIDDEN_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /api[_-]?key/i,
  /-----begin .*private key-----/i,
  /sk-[a-z0-9]{20,}/i,
  /xox[baprs]-/i,
];

export function validateMemoryCreateInput(input: MemoryCreateInput): { ok: true } | { ok: false; error: string } {
  if (input.source === "user_explicit_save" && input.category === "conversation_summary") {
    return { ok: false, error: "conversation_summary is not allowed for manual memory capture." };
  }

  if (input.scope === "project" && !input.projectId) {
    return { ok: false, error: "project scope requires projectId." };
  }
  if (input.scope === "customer" && !input.customerId) {
    return { ok: false, error: "customer scope requires customerId." };
  }
  if (input.scope === "user" && !input.userId) {
    return { ok: false, error: "user scope requires userId." };
  }
  if (input.scope === "task" && !input.taskId) {
    return { ok: false, error: "task scope requires taskId." };
  }
  if (input.scope === "phase" && !input.phaseId) {
    return { ok: false, error: "phase scope requires phaseId." };
  }

  if (!isSafeVisibleText(input.title) || input.title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: "Invalid title." };
  }
  if (!isSafeVisibleText(input.summary) || input.summary.length > MAX_SUMMARY_LENGTH) {
    return { ok: false, error: "Invalid summary." };
  }

  const detailsResult = validateDetailsJson(input.details);
  if (!detailsResult.ok) {
    return detailsResult;
  }

  const sourceValidation = validateSourceReferences(input.sourceReferences);
  if (!sourceValidation.ok) {
    return sourceValidation;
  }

  if (input.tags.length > MAX_TAG_COUNT) {
    return { ok: false, error: "Too many tags." };
  }

  for (const tag of input.tags) {
    if (!isSafeVisibleText(tag) || tag.length > MAX_TAG_LENGTH) {
      return { ok: false, error: "Invalid tag." };
    }
  }

  if (!isSafeVisibleText(input.reason) || input.reason.length > 300) {
    return { ok: false, error: "Invalid reason." };
  }

  return { ok: true };
}

export function validateMemoryUpdateInput(input: MemoryUpdateInput): { ok: true } | { ok: false; error: string } {
  if (input.title !== undefined && (!isSafeVisibleText(input.title) || input.title.length > MAX_TITLE_LENGTH)) {
    return { ok: false, error: "Invalid title." };
  }
  if (input.summary !== undefined && (!isSafeVisibleText(input.summary) || input.summary.length > MAX_SUMMARY_LENGTH)) {
    return { ok: false, error: "Invalid summary." };
  }
  if (input.details !== undefined) {
    const detailsResult = validateDetailsJson(input.details);
    if (!detailsResult.ok) {
      return detailsResult;
    }
  }
  if (input.sourceReferences !== undefined) {
    const sourceValidation = validateSourceReferences(input.sourceReferences);
    if (!sourceValidation.ok) {
      return sourceValidation;
    }
  }
  if (input.tags !== undefined) {
    if (input.tags.length > MAX_TAG_COUNT) {
      return { ok: false, error: "Too many tags." };
    }
    for (const tag of input.tags) {
      if (!isSafeVisibleText(tag) || tag.length > MAX_TAG_LENGTH) {
        return { ok: false, error: "Invalid tag." };
      }
    }
  }
  return { ok: true };
}

function validateDetailsJson(value: MemoryJson): { ok: true } | { ok: false; error: string } {
  let serialized = "";
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, error: "details must be valid JSON." };
  }

  if (Buffer.byteLength(serialized, "utf8") > MAX_JSON_BYTES) {
    return { ok: false, error: "details exceeds maximum size." };
  }

  if (containsForbiddenPattern(serialized)) {
    return { ok: false, error: "details contain forbidden content." };
  }

  return { ok: true };
}

function isSafeVisibleText(value: string): boolean {
  if (!value || value.trim().length === 0) {
    return false;
  }

  if (containsForbiddenPattern(value)) {
    return false;
  }

  return !/[<>]/.test(value);
}

function containsForbiddenPattern(value: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(value));
}

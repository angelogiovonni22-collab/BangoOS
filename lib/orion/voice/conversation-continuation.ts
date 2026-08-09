const DEFAULT_CONTINUATION_TTL_MS = 30_000;

let continuationExpiresAt = 0;
let continuationReason: string | null = null;

function nowMs() {
  return Date.now();
}

export function armOrionConversationContinuation(reason: string, ttlMs = DEFAULT_CONTINUATION_TTL_MS) {
  continuationReason = reason;
  continuationExpiresAt = nowMs() + Math.max(1_000, ttlMs);
}

export function clearOrionConversationContinuation() {
  continuationExpiresAt = 0;
  continuationReason = null;
}

export function hasOrionConversationContinuation() {
  if (continuationExpiresAt <= nowMs()) {
    clearOrionConversationContinuation();
    return false;
  }

  return true;
}

export function consumeOrionConversationContinuation() {
  if (!hasOrionConversationContinuation()) {
    return null;
  }

  const reason = continuationReason;
  clearOrionConversationContinuation();
  return reason || "follow_up";
}

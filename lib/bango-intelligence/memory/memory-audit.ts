import type { MemoryAuditEvent } from "./memory-types";

export function logMemoryAuditEvent(event: MemoryAuditEvent): void {
  console.log(JSON.stringify({
    level: event.success ? "info" : "warn",
    event: "bango_memory_operation",
    requestId: event.requestId,
    userId: event.userId,
    companyId: event.companyId,
    operation: event.operation,
    memoryId: event.memoryId,
    scope: event.scope,
    category: event.category,
    source: event.source,
    success: event.success,
    validationResult: event.validationResult,
    authorizationResult: event.authorizationResult,
    deduplicationOutcome: event.deduplicationOutcome,
    durationMs: event.durationMs,
    failureReason: event.failureReason ?? undefined,
  }));
}

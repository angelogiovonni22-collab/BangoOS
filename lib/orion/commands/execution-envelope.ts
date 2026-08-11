const MAX_COMMAND_ID_LENGTH = 80;
const MAX_CORRELATION_ID_LENGTH = 100;

function createCorrelationId(prefix = "orion") {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createOrionExecutionEnvelope(commandId: string, prefix = "orion", executionId?: string) {
  const normalizedExecutionId = executionId?.trim();
  const correlationId = normalizedExecutionId
    ? `${prefix}-${normalizedExecutionId.slice(0, MAX_CORRELATION_ID_LENGTH - prefix.length - 1)}`
    : createCorrelationId(prefix);
  const normalizedCommandId = commandId.trim().slice(0, MAX_COMMAND_ID_LENGTH) || "command";
  const idempotencyKey = `${normalizedCommandId}:${correlationId.slice(0, MAX_CORRELATION_ID_LENGTH)}`;

  return { correlationId, idempotencyKey };
}

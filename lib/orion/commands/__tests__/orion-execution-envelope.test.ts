import assert from "node:assert/strict";
import { createOrionExecutionEnvelope } from "../execution-envelope";

const largeCommandId = `estimate.${"x".repeat(500)}`;
const first = createOrionExecutionEnvelope(largeCommandId, "orion-realtime");
const second = createOrionExecutionEnvelope(largeCommandId, "orion-realtime");
const retry = createOrionExecutionEnvelope(largeCommandId, "orion-realtime", "call-123");
const sameRetry = createOrionExecutionEnvelope(largeCommandId, "orion-realtime", "call-123");

assert.ok(first.correlationId.startsWith("orion-realtime-"));
assert.ok(first.idempotencyKey.length <= 200, "idempotency keys stay inside the event contract");
assert.notEqual(first.idempotencyKey, second.idempotencyKey, "separate user turns do not collide");
assert.equal(retry.idempotencyKey, sameRetry.idempotencyKey, "retries of one Realtime call keep the same key");
assert.ok(
  `${first.idempotencyKey}:estimate-sent`.length <= 200,
  "handler event suffixes stay inside the event contract",
);

console.log("Orion execution envelope: 5 passed, 0 failed");

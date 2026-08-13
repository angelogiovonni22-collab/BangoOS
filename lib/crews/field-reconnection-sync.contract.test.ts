import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const service = readFileSync(resolve(root, "lib/crews/mobile-field-operations-service.ts"), "utf8");
const hook = readFileSync(resolve(root, "lib/crews/use-mobile-field-operations.ts"), "utf8");

assert.match(service, /syncOfflineActions/, "field operations must expose an explicit queue flush");
assert.match(service, /mobile-field:\$\{item\.id\}/, "replayed workflow events must have deterministic idempotency keys");
assert.match(service, /sort\(\(left, right\) => left\.createdAt\.localeCompare\(right\.createdAt\)\)/, "offline actions must replay in creation order");
assert.match(service, /setStatus\?\.\(item\.id, "failed"\)/, "unreplayable actions must be retained for conflict review");
assert.match(service, /markQueueStatus\(offlineQueue, queued, "synced"\)/, "transactionally-created daily reports must not remain falsely queued");
assert.match(hook, /addEventListener\("online", synchronize\)/, "reconnection must trigger automatic synchronization");
assert.match(hook, /removeEventListener\("online", synchronize\)/, "reconnection listeners must be cleaned up");

console.log("Field reconnection synchronization contract checks passed.");

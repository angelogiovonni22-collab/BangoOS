import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const queue = readFileSync(resolve(root, "lib/crews/field-offline-queue.ts"), "utf8");
const hook = readFileSync(resolve(root, "lib/crews/use-mobile-field-operations.ts"), "utf8");
const service = readFileSync(resolve(root, "lib/crews/mobile-field-operations-service.ts"), "utf8");

assert.match(queue, /indexedDB\.open\(DATABASE_NAME, DATABASE_VERSION\)/, "field actions must survive reloads in IndexedDB");
assert.match(queue, /createObjectStore\(STORE_NAME, \{ keyPath: "id" \}\)/, "offline actions require stable identities");
assert.match(queue, /setStatus/, "persistent queue entries must support lifecycle updates");
assert.match(queue, /scopeKey: await getScopeKey\(\)/, "offline actions must be scoped to the authenticated company and user");
assert.match(queue, /item\.scopeKey === scopeKey/, "one workspace must never read another workspace's queued actions");
assert.match(hook, /createBrowserFieldOfflineProviders/, "the production field hook must use durable browser providers");
assert.match(service, /await provider\.setStatus\?\./, "successful server writes must persist synced queue state");
assert.match(hook, /companyId: result\.context\.companyId, userId: result\.context\.userId/, "offline scope must come from the verified workspace context");

console.log("Field offline queue contract checks passed.");

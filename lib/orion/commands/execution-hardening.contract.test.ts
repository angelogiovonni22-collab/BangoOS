import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const router = readFileSync("lib/orion/commands/router.ts", "utf8");
const history = readFileSync("lib/orion/commands/history.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };

assert.match(history, /findOrionCommandHistoryByIdempotency/, "History layer must support idempotency lookup for command replay.");
assert.match(router, /findOrionCommandHistoryByIdempotency/, "Command router must check prior history before re-running an idempotent command.");
assert.match(router, /idempotentReplay: true/, "Successful prior command execution must be returned as an idempotent replay.");
assert.match(router, /verification_status/, "Completed command history must record a verification status.");
assert.match(router, /const verificationStatus = succeeded \? "verified" : "failed"/, "Successful command state must resolve to verified and unsuccessful command state to failed.");
assert.match(router, /verification_status:\s*verificationStatus/, "Resolved verification state must be persisted before completion is reported.");
assert.match(router, /verification_status:\s*"failed"/, "Failed commands must record failed verification state.");
assert.match(packageJson.scripts?.check || "", /execution-hardening\.contract\.test\.ts/, "Repository check must permanently include Orion execution hardening validation.");

console.log("Orion execution hardening contract passed.");

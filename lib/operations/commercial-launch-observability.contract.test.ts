import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const health = read("app/api/health/route.ts");
assert.match(health, /force-dynamic/, "health responses must not be cached");
assert.match(health, /admin\.from\("companies"\)/, "health must verify Production database access");
assert.match(health, /admin\.storage\.listBuckets/, "health must verify Production Storage access");
assert.match(health, /status: healthy \? 200 : 503/, "degraded dependencies must fail the health check");
assert.doesNotMatch(health, /SUPABASE_SERVICE_ROLE_KEY|publishableKey/, "health output must not expose credential names or values");

const instrumentation = read("instrumentation.ts");
assert.match(instrumentation, /export function onRequestError/, "Next.js request failures must emit structured telemetry");
assert.doesNotMatch(instrumentation, /error\.message|request\.headers|request\.body/, "telemetry must not record sensitive request or error details");

const workflow = read(".github/workflows/production-smoke.yml");
assert.match(workflow, /schedule:/, "Production monitoring must run on a schedule");
assert.match(workflow, /workflow_dispatch:/, "operators must be able to run the smoke manually");
assert.match(workflow, /\/api\/health/, "smoke monitoring must verify dependencies");
assert.match(workflow, /supabase-test/, "smoke monitoring must guard the removed developer surface");

const runbook = read("docs/operations/COMMERCIAL-LAUNCH-RUNBOOK.md");
for (const requirement of ["SEV-1", "Incident workflow", "Restore to a new project", "Release and rollback gate", "Support intake requirements"]) {
  assert.ok(runbook.includes(requirement), `runbook must include ${requirement}`);
}

console.log("Commercial-launch observability contract passed.");

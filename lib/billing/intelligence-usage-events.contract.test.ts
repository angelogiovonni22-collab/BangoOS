import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260909203000_bos_intelligence_usage_events.sql"), "utf8");
const recorder = readFileSync(resolve(process.cwd(), "lib/billing/intelligence-usage-events.ts"), "utf8");
const orion = readFileSync(resolve(process.cwd(), "lib/orion/intelligence/openai-intelligence.ts"), "utf8");
const blueprint = readFileSync(resolve(process.cwd(), "lib/blueprints/visual-mockup.ts"), "utf8");
const blueprintRoute = readFileSync(resolve(process.cwd(), "app/api/blueprints/[versionId]/visual-mockup/route.ts"), "utf8");

assert.match(migration, /create table if not exists public\.bos_intelligence_usage_events/);
assert.match(migration, /unique \(company_id, operation_key\)/, "Provider retries need tenant-scoped idempotency evidence");
assert.match(migration, /outcome in \('succeeded', 'provider_failed', 'bos_failed', 'customer_canceled'\)/);
assert.match(migration, /provider_cost_micros bigint/);
assert.match(migration, /enable row level security/);
assert.match(migration, /before update or delete/, "Usage telemetry must be append-only");
assert.match(migration, /revoke all privileges .* from authenticated/i);
assert.match(migration, /grant select .* to authenticated/i);
assert.match(migration, /grant select, insert .* to service_role/i);
assert.doesNotMatch(migration, /insert into public\.bos_intelligence_usage_ledger/i, "Telemetry must never settle or consume credits");

assert.match(recorder, /intentionally never throws/i, "Telemetry must fail open for product workflows");
assert.match(recorder, /bos_intelligence_usage_events/);
assert.doesNotMatch(recorder, /bos_intelligence_usage_ledger/, "The event recorder must not mutate settled accounting");

assert.match(orion, /recordBosIntelligenceUsageEvent/);
assert.match(orion, /product: "orion_text"/);
assert.match(orion, /outcome: "provider_failed"/);
assert.match(orion, /outcome: "succeeded"/);
assert.match(orion, /input_tokens/);
assert.match(orion, /output_tokens/);

assert.match(blueprint, /recordBosIntelligenceUsageEvent/);
assert.match(blueprint, /product: "blueprint_visual_mockup"/);
assert.match(blueprint, /providerRequestId = response\.headers\.get\("x-request-id"\)/);
assert.match(blueprintRoute, /telemetry:\s*\{/);
assert.match(blueprintRoute, /companyId: source\.company_id/);

console.log("B.O.S. Intelligence non-settling usage telemetry contract checks passed.");

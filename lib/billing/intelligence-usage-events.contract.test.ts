import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260909203000_bos_intelligence_usage_events.sql"), "utf8");
const internalRpcMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260910030000_bos_internal_intelligence_usage_rpc.sql"), "utf8");
const recorder = readFileSync(resolve(process.cwd(), "lib/billing/intelligence-usage-events.ts"), "utf8");
const orion = readFileSync(resolve(process.cwd(), "lib/orion/intelligence/openai-intelligence.ts"), "utf8");
const orionFallback = readFileSync(resolve(process.cwd(), "lib/orion/intelligence/intent-fallback.ts"), "utf8");
const deterministicOrion = readFileSync(resolve(process.cwd(), "lib/orion/intent-engine/metered-service.ts"), "utf8");
const intentIndex = readFileSync(resolve(process.cwd(), "lib/orion/intent-engine/index.ts"), "utf8");
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

assert.match(internalRpcMigration, /security definer/i);
assert.match(internalRpcMigration, /v_user_id uuid := auth\.uid\(\)/, "Internal telemetry RPC must bind actor identity to the authenticated user");
assert.match(internalRpcMigration, /membership\.status = 'active'/, "Internal telemetry RPC must require active tenant membership");
assert.match(internalRpcMigration, /project\.company_id = p_company_id/, "Project-scoped internal telemetry must verify tenant ownership");
assert.match(internalRpcMigration, /internal_non_billable[\s\S]*true/, "Internal telemetry must be forced non-billable");
assert.match(internalRpcMigration, /provider_cost_micros[\s\S]*0/, "Internal telemetry must force provider cost to zero");
assert.match(internalRpcMigration, /revoke all on function .* from public/i);
assert.match(internalRpcMigration, /grant execute on function .* to authenticated/i);
assert.doesNotMatch(internalRpcMigration, /bos_intelligence_usage_ledger/, "Internal telemetry RPC must never touch settled accounting");

assert.match(recorder, /recordBosIntelligenceUsageEvent/);
assert.match(recorder, /recordBosInternalIntelligenceUsageEvent/);
assert.match(recorder, /record_bos_internal_intelligence_usage_event/);
assert.doesNotMatch(recorder, /bos_intelligence_usage_ledger/, "The event recorder must not mutate settled accounting");

assert.match(orion, /recordBosIntelligenceUsageEvent/);
assert.match(orion, /product: "orion_text"/);
assert.match(orion, /outcome: "provider_failed"/);
assert.match(orion, /outcome: "succeeded"/);
assert.match(orion, /input_tokens/);
assert.match(orion, /output_tokens/);

assert.match(deterministicOrion, /recordBosInternalIntelligenceUsageEvent/);
assert.match(deterministicOrion, /params\.supabase/);
assert.match(deterministicOrion, /executionMode: "bos_deterministic"/);
assert.match(deterministicOrion, /if \(result\.suggestedCommand \|\| result\.requiresClarification\)/, "Only deterministic handled turns should emit the internal event; unresolved turns may continue to provider-backed fallback");
assert.match(intentIndex, /resolveOrionIntent.*metered-service/, "Public Orion command-center imports must use the metered deterministic wrapper");

assert.match(orionFallback, /const supabase = await createClient\(\)/, "Native project summary must use the authenticated server client rather than service-role configuration");
assert.match(orionFallback, /recordBosInternalIntelligenceUsageEvent\(supabase/);
assert.doesNotMatch(orionFallback, /createAdminClient/, "Native project summary must not depend on the service-role environment");

assert.match(blueprint, /recordBosIntelligenceUsageEvent/);
assert.match(blueprint, /product: "blueprint_visual_mockup"/);
assert.match(blueprint, /providerRequestId = response\.headers\.get\("x-request-id"\)/);
assert.match(blueprintRoute, /telemetry:\s*\{/);
assert.match(blueprintRoute, /companyId: source\.company_id/);

console.log("B.O.S. Intelligence non-settling usage telemetry contract checks passed.");

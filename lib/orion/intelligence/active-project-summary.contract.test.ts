import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fallback = readFileSync(resolve(process.cwd(), "lib/orion/intelligence/intent-fallback.ts"), "utf8");
const meteredIntent = readFileSync(resolve(process.cwd(), "lib/orion/intent-engine/metered-service.ts"), "utf8");

assert.match(fallback, /export async function resolveNativeActiveProjectSummary/);
assert.match(fallback, /projectIdFromRoute/);
assert.match(fallback, /this project\|the project\|this job\|the job\|this page\|what i have open/);
assert.match(fallback, /summary\|summar/);
assert.match(fallback, /const supabase = await createClient\(\)/, "Active project reads must use the authenticated server client");
assert.doesNotMatch(fallback, /createAdminClient/, "Native active-project context must not depend on service-role configuration");
assert.match(fallback, /\.eq\("company_id", args\.workspace\.companyId\)/, "Active project reads must remain tenant-scoped");
assert.match(fallback, /\.eq\("id", projectId\)/, "Active project reads must target the exact current project");
assert.match(fallback, /executionMode: "bos_native_project_context"/);
assert.match(fallback, /recordBosInternalIntelligenceUsageEvent\(supabase/, "Native project summaries must meter through the authenticated non-billable RPC path");
assert.match(fallback, /product: "orion_text"/);
assert.match(fallback, /sourceType: "project"/);
assert.match(fallback, /const nativeProjectSummary = await resolveNativeActiveProjectSummary\(args\)/);
assert.match(fallback, /if \(nativeProjectSummary\) return nativeProjectSummary/);

assert.match(meteredIntent, /resolveNativeActiveProjectSummary/);
const nativePosition = meteredIntent.indexOf("const activeProjectSummary = await resolveNativeActiveProjectSummary");
const genericPosition = meteredIntent.indexOf("const result = await resolveOrionIntentRaw");
assert.ok(nativePosition >= 0 && genericPosition >= 0 && nativePosition < genericPosition, "Active-page project context must resolve before generic intent clarification");
assert.match(meteredIntent, /if \(activeProjectSummary\) \{[\s\S]*return activeProjectSummary\.intent;/, "Resolved active project context must bypass generic clarification");

console.log("Orion active-project native summary contract checks passed.");

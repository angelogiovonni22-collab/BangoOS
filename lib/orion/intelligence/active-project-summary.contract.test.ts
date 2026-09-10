import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fallback = readFileSync(resolve(process.cwd(), "lib/orion/intelligence/intent-fallback.ts"), "utf8");

assert.match(fallback, /resolveNativeActiveProjectSummary/);
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

console.log("Orion active-project native summary contract checks passed.");

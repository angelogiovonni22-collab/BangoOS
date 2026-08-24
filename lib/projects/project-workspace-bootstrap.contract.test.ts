import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migration = readFileSync(resolve(root, "supabase/migrations/20260824050000_estimate_approved_project_workspace_bootstrap.sql"), "utf8");
const projectPage = readFileSync(resolve(root, "app/(app)/projects/[id]/page.tsx"), "utf8");
const panel = readFileSync(resolve(root, "components/projects/workspace/project-operating-system-panel.tsx"), "utf8");

assert.match(migration, /pg_advisory_xact_lock/, "workspace bootstrap must serialize concurrent retries");
assert.match(migration, /partition by lower\(btrim\(s\.name\)\)/, "estimate section phase names must be deduplicated deterministically");
assert.match(migration, /order by s\.sort_order, s\.id/, "duplicate section selection must preserve exact deterministic ordering");
assert.match(migration, /'Pre-Construction', 100[\s\S]*'Execution', 200[\s\S]*'Closeout', 300/, "fallback phase order must be Pre-Construction, Execution, Closeout");
assert.match(migration, /project\.workspace_bootstrapped/, "the canonical workspace bootstrap event must be recorded");
assert.match(migration, /on conflict \(company_id, event_type, idempotency_key\)/, "bootstrap event retries must be idempotent");
assert.match(migration, /after insert or update of status, project_id, converted_project_id/, "approved conversions must trigger workspace bootstrap automatically");
assert.match(migration, /revoke all on function public\.bootstrap_estimate_project_workspace\(uuid, uuid\) from public, anon, authenticated/, "workspace bootstrap must be server-only");
assert.match(projectPage, /<ProjectOperatingSystemPanel/, "the project workspace must render the B.O.S. operating system panel");
assert.match(panel, /Operating Score/);
assert.match(panel, /Delivery Risk/);
assert.match(panel, /Budget Variance/);
assert.match(panel, /Workflow Coverage/);
assert.match(panel, /Orion Recommended Actions/);

console.log("project workspace bootstrap contract passed");

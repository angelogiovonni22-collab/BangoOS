import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateProjectComplianceReadiness } from "./project-compliance-readiness";
import { calculateProjectExecutionReadiness } from "./project-execution-readiness";

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
assert.match(projectPage, /<ProjectOperatingSystemPanel[\s\S]*?t=\{\(key, params\) => t\(`projects\.\$\{key\}`/, "Orion action copy must resolve through the projects translation namespace");
assert.match(projectPage, /compliance=\{\{[\s\S]*permitsTotal:[\s\S]*openPermits:[\s\S]*inspectionsTotal:[\s\S]*pendingInspections:[\s\S]*documentsTotal:/, "the operating panel must receive live compliance signals");
assert.match(panel, /Operating Score/);
assert.match(panel, /Delivery Risk/);
assert.match(panel, /Budget Variance/);
assert.match(panel, /Workflow Coverage/);
assert.match(panel, /Orion Recommended Actions/);
assert.match(panel, /Compliance Readiness/);
assert.match(panel, /Execution Readiness/);
assert.match(panel, /Next operating action/);
assert.match(panel, /data-testid="project-execution-readiness"/);
assert.equal(calculateProjectComplianceReadiness({ permitsTotal: 1, openPermits: 0, inspectionsTotal: 1, pendingInspections: 0, documentsTotal: 1 }).status, "Ready");
assert.equal(calculateProjectComplianceReadiness({ permitsTotal: 0, openPermits: 0, inspectionsTotal: 0, pendingInspections: 0, documentsTotal: 0 }).status, "Setup required");
assert.equal(calculateProjectExecutionReadiness({ complianceScore: 100, overdueTasks: 0, blockedTasks: 0, activeTasks: 1, documentationPresent: true }).status, "Ready");
assert.equal(calculateProjectExecutionReadiness({ complianceScore: 10, overdueTasks: 0, blockedTasks: 0, activeTasks: 0, documentationPresent: false }).nextAction, "compliance");

console.log("project workspace bootstrap contract passed");

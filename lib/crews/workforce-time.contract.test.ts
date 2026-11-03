import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const initialMigration = readFileSync(resolve(root, "supabase/migrations/20260814113000_workforce_time_entries.sql"), "utf8");
const assignmentGuard = readFileSync(resolve(root, "supabase/migrations/20261103152000_workforce_time_assignment_link_guard.sql"), "utf8");
const service = readFileSync(resolve(root, "lib/crews/workforce-time.ts"), "utf8");
const workspace = readFileSync(resolve(root, "components/crews/mobile-field-operations-workspace.tsx"), "utf8");

assert.match(initialMigration, /enable row level security/);
assert.match(initialMigration, /one_open_employee/);
assert.match(initialMigration, /record_workforce_time_event/);
assert.match(initialMigration, /created_by=auth\.uid\(\)/);
assert.match(service, /resolveWorkspaceContext/);
assert.match(workspace, /MobileWorkforceTimeClock/);
assert.match(workspace, /selectedTimeAssignmentId/);
assert.match(workspace, /selectedCrewAssignments\.length > 1/);
assert.match(workspace, /selectedTimeAssignment\?\.projectId/);
assert.match(workspace, /selectedTimeAssignment\?\.assignmentId/);
assert.match(workspace, /assignment\.status === "published" \|\| assignment\.status === "in_progress"/);

// Regression: the database, not just the browser, validates time attribution.
assert.match(assignmentGuard, /security invoker/);
assert.match(assignmentGuard, /before insert or update of company_id, employee_id, project_id, assignment_id/);
assert.match(assignmentGuard, /v_assignment\.project_id is distinct from new\.project_id/);
assert.match(assignmentGuard, /v_assignment\.employee_id is distinct from new\.employee_id/);
assert.match(assignmentGuard, /from public\.crew_memberships m/);
assert.match(assignmentGuard, /m\.crew_id=v_assignment\.crew_id/);
assert.match(assignmentGuard, /m\.employee_id=new\.employee_id/);
assert.match(assignmentGuard, /m\.status='active'/);
assert.match(assignmentGuard, /at time zone coalesce\(nullif\(btrim\(c\.timezone\)/);
assert.match(assignmentGuard, /revoke all on function/);
console.log("Workforce time and assignment-attribution contract checks passed.");

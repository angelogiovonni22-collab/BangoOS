import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const initialMigration = readFileSync(resolve(root, "supabase/migrations/20260814113000_workforce_time_entries.sql"), "utf8");
const assignmentGuard = readFileSync(resolve(root, "supabase/migrations/20261103153059_workforce_time_assignment_link_guard.sql"), "utf8");
const selfClockOutGuard = readFileSync(resolve(root, "supabase/migrations/20261103153953_workforce_self_clockout_rls.sql"), "utf8");
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
// RLS limits employee self-service writes, while a trigger enforces the
// clock-in timestamp and the open-to-submitted state transition.
assert.match(selfClockOutGuard, /create policy workforce_time_entries_employee_clock_out/);
assert.match(selfClockOutGuard, /status='open'/);
assert.match(selfClockOutGuard, /status='submitted'/);
assert.match(selfClockOutGuard, /e\.company_id=workforce_time_entries\.company_id/);
assert.match(selfClockOutGuard, /old\.status <> 'open' or new\.status <> 'submitted'/);
assert.match(selfClockOutGuard, /new\.started_at := statement_timestamp\(\)/);
assert.match(selfClockOutGuard, /new\.ended_at := statement_timestamp\(\)/);
assert.match(selfClockOutGuard, /new\.assignment_id,\s*new\.started_at/);
assert.match(selfClockOutGuard, /new\.approved_by,\s*new\.approved_at/);
assert.match(selfClockOutGuard, /revoke all on function public\.guard_workforce_self_time_write/);
console.log("Workforce time, self clock-out and assignment-attribution contract checks passed.");

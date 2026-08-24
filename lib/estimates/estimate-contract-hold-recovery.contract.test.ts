import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migration = readFileSync(resolve(root, "supabase/migrations/20260823040000_sync_estimate_project_contract_compliance_hold.sql"), "utf8");
const signingRoute = readFileSync(resolve(root, "app/api/contracts/estimate/[token]/route.ts"), "utf8");

assert.match(migration, /sync_estimate_project_contract_compliance_hold/, "canonical project-hold synchronization must exist");
assert.match(migration, /after insert or update of transaction_signed_at, cancellation_deadline_date, cancelled_at, work_released_at, work_start_hold_configured/, "profile changes must synchronize the project hold");
assert.match(migration, /after insert or update of project_id/, "late or recovered conversions must synchronize the project hold");
assert.match(migration, /contract_compliance_hold_reason in/, "the synchronizer must not clear unrelated project holds");
assert.match(migration, /grant execute on function public\.sync_estimate_project_contract_compliance_hold\(uuid, uuid\) to service_role/, "only the server role may call the synchronizer directly");
assert.match(signingRoute, /sync_estimate_project_contract_compliance_hold/, "the signing response must verify canonical hold synchronization");
assert.doesNotMatch(signingRoute, /from\("projects"\)\.update\(\{ contract_compliance_hold_active: true/, "the route must not maintain a competing project-hold implementation");

console.log("estimate contract hold recovery contract passed");

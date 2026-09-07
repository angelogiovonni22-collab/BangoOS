import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const home = read("app/page.tsx");
assert.match(home, /redirect\(["']\/app-entry["']\)/, "the public root must use the role-aware app entry");
assert.doesNotMatch(home, /supabase-test|href=["']\/crm/, "the public root must not expose developer shortcuts");

const diagnostic = read("app/supabase-test/page.tsx");
assert.match(diagnostic, /notFound\(\)/, "the Supabase diagnostic route must not be publicly rendered");
assert.doesNotMatch(diagnostic, /createClient|environment variables|configuration successful/i, "the diagnostic route must not disclose environment readiness");

const migration = read("supabase/migrations/20260830220000_commercial_launch_authenticated_rpc_hardening.sql");
const internalRoutines = [
  "close_trade_partner_access_when_project_completed()",
  "publish_blueprint_revision_ack_event()",
  "publish_blueprint_revision_status_event()",
  "trade_partner_review_rating_trigger()",
  "trg_company_memberships_sync_profiles_fn()",
  "trg_crew_memberships_validate_fn()",
  "refresh_trade_partner_vendor_rating(uuid)",
  "seed_default_system_units_of_measure()",
];

for (const routine of internalRoutines) {
  const escaped = routine.replace(/[()]/g, "\\$&");
  assert.match(
    migration,
    new RegExp(`revoke execute on function public\\.${escaped} from public, anon, authenticated`, "i"),
    `${routine} must not be callable as an authenticated RPC`,
  );
  assert.match(
    migration,
    new RegExp(`grant execute on function public\\.${escaped} to service_role`, "i"),
    `${routine} must remain available to trusted database operations`,
  );
}

const projectLifecycleMigration = read("supabase/migrations/20260907023500_project_lifecycle_permission_hardening.sql");
for (const routine of ["soft_delete_project", "restore_deleted_project"]) {
  assert.match(
    projectLifecycleMigration,
    new RegExp(`create or replace function public\\.${routine}`, "i"),
    `${routine} must be hardened at the database boundary`,
  );
}
const projectManageChecks = projectLifecycleMigration.match(/bos_role_has_permission\(v_company_id,\s*'projects\.manage',\s*auth\.uid\(\)\)/gi) ?? [];
assert.equal(projectManageChecks.length, 2, "project delete and restore must both require projects.manage and honor permission overrides");
assert.match(projectLifecycleMigration, /revoke all on function public\.soft_delete_project\(uuid\) from public, anon/i);
assert.match(projectLifecycleMigration, /revoke all on function public\.restore_deleted_project\(uuid\) from public, anon/i);

console.log("Commercial-launch entry and authenticated RPC contract passed.");

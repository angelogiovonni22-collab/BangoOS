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

const mobilizationMigration = read("supabase/migrations/20260907024500_subcontractor_mobilization_rpc_hardening.sql");
assert.match(
  mobilizationMigration,
  /revoke execute on function public\.refresh_subcontractor_mobilization_status\(uuid, uuid\)[\s\S]*from public, anon, authenticated/i,
  "mobilization refresh must not remain a signed-in browser RPC",
);
assert.match(
  mobilizationMigration,
  /grant execute on function public\.refresh_subcontractor_mobilization_status\(uuid, uuid\)[\s\S]*to service_role/i,
  "mobilization refresh must remain available to trusted server workflows",
);

const estimateConversionMigration = read("supabase/migrations/20260907030000_estimate_conversion_rpc_permission_hardening.sql");
assert.match(
  estimateConversionMigration,
  /bos_role_has_permission\(p_company_id,\s*'estimates\.manage',\s*auth\.uid\(\)\)/i,
  "estimate conversion must require estimates.manage",
);
assert.match(
  estimateConversionMigration,
  /bos_role_has_permission\(p_company_id,\s*'projects\.manage',\s*auth\.uid\(\)\)/i,
  "estimate conversion must also require projects.manage because it creates a project",
);
assert.match(
  estimateConversionMigration,
  /revoke all on function public\.convert_estimate_to_project_internal\(uuid, uuid, uuid, text, boolean\)[\s\S]*from public, anon, authenticated/i,
  "the original SECURITY DEFINER conversion implementation must become internal-only",
);
assert.match(
  estimateConversionMigration,
  /grant execute on function public\.convert_estimate_to_project_internal\(uuid, uuid, uuid, text, boolean\)[\s\S]*to service_role/i,
  "trusted server operations must retain access to the internal conversion implementation",
);

const estimateDepositMigration = read("supabase/migrations/20260907032000_estimate_deposit_rpc_permission_hardening.sql");
assert.match(
  estimateDepositMigration,
  /bos_role_has_permission\(p_company_id,\s*'estimates\.view',\s*auth\.uid\(\)\)/i,
  "deposit calculation must require estimates.view because it exposes estimate financial data",
);
assert.match(
  estimateDepositMigration,
  /revoke all on function public\.calculate_estimate_deposit_internal\(uuid, uuid\)[\s\S]*from public, anon, authenticated/i,
  "the compliant deposit implementation must not remain directly callable by signed-in clients",
);
assert.match(
  estimateDepositMigration,
  /grant execute on function public\.calculate_estimate_deposit\(uuid, uuid\)[\s\S]*to authenticated/i,
  "authorized signed-in workflows must retain the guarded deposit calculation RPC",
);

const sequenceMigration = read("supabase/migrations/20260907034000_sequence_allocator_permission_hardening.sql");
for (const [routine, permission] of [
  ["allocate_estimate_number", "estimates.manage"],
  ["allocate_project_number", "projects.manage"],
  ["allocate_change_order_number", "change_orders.manage"],
] as const) {
  assert.match(
    sequenceMigration,
    new RegExp(`bos_role_has_permission\\(p_company_id,\\s*'${permission.replace(".", "\\.")}',\\s*auth\\.uid\\(\\)\\)`, "i"),
    `${routine} must require ${permission}`,
  );
  assert.match(
    sequenceMigration,
    new RegExp(`revoke all on function public\\.${routine}_internal\\(uuid\\)[\\s\\S]*from public, anon, authenticated`, "i"),
    `${routine} internal allocator must not remain directly callable by signed-in clients`,
  );
  assert.match(
    sequenceMigration,
    new RegExp(`grant execute on function public\\.${routine}\\(uuid\\)[\\s\\S]*to authenticated`, "i"),
    `${routine} guarded RPC must remain available to authorized signed-in workflows`,
  );
}

console.log("Commercial-launch entry and authenticated RPC contract passed.");

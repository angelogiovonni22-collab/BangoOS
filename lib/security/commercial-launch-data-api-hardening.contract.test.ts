import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const migration = read("supabase/migrations/20260906002000_commercial_launch_sequence_table_data_api_hardening.sql");
const planPackageMigration = read("supabase/migrations/20260813010000_blueprint_plan_packages.sql");
const rpcHardeningMigration = read("supabase/migrations/20260830210000_commercial_launch_rpc_security_hardening.sql");

for (const table of [
  "company_change_order_sequences",
  "company_estimate_sequences",
  "company_project_sequences",
]) {
  assert.match(
    migration,
    new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, "i"),
    `${table} must not remain directly accessible through the JWT Data API roles`,
  );
}

assert.match(
  planPackageMigration,
  /grant execute on function public\.validate_blueprint_plan_package\(text\) to anon, authenticated/i,
  "Public plan-package token validation must remain intentionally callable by the share flow",
);
assert.match(
  rpcHardeningMigration,
  /grant execute on function public\.validate_blueprint_plan_package\(text\) to anon/i,
  "Commercial-launch RPC hardening must preserve the intentional anonymous plan-package exception",
);
assert.doesNotMatch(
  migration,
  /revoke[^;]*validate_blueprint_plan_package[^;]*anon/i,
  "Sequence-table hardening must not break intentional public plan-package validation",
);

console.log("Commercial-launch Data API hardening contract passed.");

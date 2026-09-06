import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const migration = read("supabase/migrations/20260906002000_commercial_launch_sequence_table_data_api_hardening.sql");
const planPackageSecurity = read("lib/blueprints/plan-package-security.contract.test.ts");

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
  planPackageSecurity,
  /grant execute on function public\.validate_blueprint_plan_package\(text\) to anon, authenticated/i,
  "Public plan-package token validation is an intentional anonymous SECURITY DEFINER exception",
);
assert.doesNotMatch(
  migration,
  /revoke[^;]*validate_blueprint_plan_package[^;]*anon/i,
  "Sequence-table hardening must not break intentional public plan-package validation",
);

console.log("Commercial-launch Data API hardening contract passed.");

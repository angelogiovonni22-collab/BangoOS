import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260830210000_commercial_launch_rpc_security_hardening.sql",
);
const migration = readFileSync(migrationPath, "utf8");

assert.match(
  migration,
  /where n\.nspname = 'public'[\s\S]*and p\.prosecdef/,
  "the hardening migration must target every public SECURITY DEFINER function",
);
assert.match(
  migration,
  /revoke execute on function %s from public, anon, authenticated/,
  "implicit PUBLIC and anonymous execution must be removed",
);
assert.match(
  migration,
  /grant execute on function public\.validate_blueprint_plan_package\(text\) to anon/,
  "the expiring token-scoped blueprint package validator must remain public",
);
assert.doesNotMatch(
  migration,
  /grant execute on function public\.validate_estimate_public_token[^\n]+to anon/,
  "estimate token validation must remain behind the server route",
);
assert.match(
  migration,
  /alter default privileges in schema public[\s\S]*revoke execute on functions from public, anon/,
  "future public functions must not regain anonymous execution by default",
);

console.log("Commercial-launch RPC security contract passed.");

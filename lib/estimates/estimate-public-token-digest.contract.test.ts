import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase",
  "migrations",
  "20260815010000_estimate_public_token_digest_schema.sql",
);
const migration = readFileSync(migrationPath, "utf8");

const checks: Array<[boolean, string]> = [
  [
    migration.includes("extensions.digest(p_token, 'sha256'::text)"),
    "public token hashing schema-qualifies the pgcrypto digest function",
  ],
  [
    migration.includes("set search_path = public, pg_temp"),
    "token validation retains its restricted security-definer search path",
  ],
  [
    migration.includes(
      "grant execute on function public.validate_estimate_public_token(text, text, text) to anon, authenticated",
    ),
    "public token validation remains available to estimate recipients",
  ],
];

let failed = 0;
for (const [condition, message] of checks) {
  if (condition) {
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}

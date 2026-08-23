import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260823030000_platform_customer_administration.sql");
const page = read("app/(app)/platform-admin/page.tsx");
const route = read("app/api/platform-admin/tenants/[companyId]/route.ts");
const shell = read("app/(app)/app-shell.tsx");

for (const table of ["bos_platform_admins", "bos_tenant_accounts", "bos_platform_audit_log"]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} has RLS enabled`);
}
assert.match(migration, /private\.is_bos_platform_admin\(\)/);
for (const protectedSource of ["companies", "company_memberships", "projects"]) assert.match(migration, new RegExp(`platform admins read customer ${protectedSource === "companies" ? "companies" : protectedSource === "company_memberships" ? "memberships" : "project counts"}`));
assert.doesNotMatch(migration, /grant .* to anon/);
assert.match(page, /redirect\("\/dashboard"\)/);
assert.match(route, /Platform administrator access is required/);
assert.match(route, /bos_platform_audit_log/);
assert.match(shell, /platformAdmin \? \[\.\.\.groups/);
console.log("B.O.S. platform administration contract: all assertions passed");

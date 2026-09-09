import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260909205000_bos_intelligence_usage_reporting.sql");
const page = read("app/(app)/platform-admin/page.tsx");

assert.match(migration, /bos_intelligence_usage_summary/);
assert.match(migration, /bos_intelligence_ledger_summary/);
assert.match(migration, /security_invoker = true/, "Reporting views must preserve underlying tenant RLS");
assert.match(migration, /provider_failed_count/);
assert.match(migration, /unpriced_event_count/);
assert.match(migration, /settled_credits_consumed/);
assert.match(migration, /customer_charge_cents::bigint \* 10000 - provider_cost_micros/, "Margin units must convert cents to micros before subtraction");
assert.match(migration, /grant select .*bos_intelligence_usage_summary to authenticated/i);
assert.match(migration, /grant select .*bos_intelligence_ledger_summary to authenticated/i);
assert.doesNotMatch(migration, /insert into public\.bos_intelligence_usage_ledger/i, "Reporting must not settle customer credits");

assert.match(page, /B\.O\.S\. Intelligence economics/);
assert.match(page, /Customer charging remains inactive/);
assert.match(page, /bos_intelligence_usage_summary/);
assert.match(page, /bos_intelligence_ledger_summary/);
assert.match(page, /unpriced/);
assert.match(page, /Provider failures/);

console.log("B.O.S. Intelligence usage reporting contract checks passed.");

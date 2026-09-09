import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260909193303_bos_intelligence_usage_metering.sql"), "utf8");

assert.match(migration, /create table if not exists public\.bos_intelligence_usage_ledger/);
assert.match(migration, /unique \(company_id, idempotency_key\)/, "Usage retries must be idempotent per tenant");
assert.match(migration, /provider_cost_micros bigint/, "The ledger must retain actual provider compute cost");
assert.match(migration, /customer_charge_cents integer/, "The ledger must retain the customer charge for margin reporting");
assert.match(migration, /entry_type = 'usage' and credit_delta < 0/, "Only usage may consume credits");
assert.match(migration, /before update or delete/, "Settled intelligence accounting must be append-only");
assert.match(migration, /enable row level security/);
assert.match(migration, /company_memberships/);
assert.match(migration, /membership\.role in \('owner', 'administrator'\)/);
assert.match(migration, /grant select on public\.bos_intelligence_usage_ledger to authenticated/);
assert.doesNotMatch(migration, /grant (?:insert|update|delete|all).*bos_intelligence_usage_ledger to authenticated/i);
assert.match(migration, /grant select, insert on public\.bos_intelligence_usage_ledger to service_role/);
assert.doesNotMatch(migration, /insert into public\.bos_intelligence_usage_ledger/, "A schema migration must not grant or consume real customer credits");

console.log("B.O.S. Intelligence append-only ledger contract checks passed.");

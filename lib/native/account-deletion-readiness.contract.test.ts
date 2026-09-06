import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const migration = read("supabase/migrations/20260906034500_user_account_deletion_requests.sql");
const api = read("app/api/account/deletion-request/route.ts");
const settings = read("app/(app)/settings/account-deletion/page.tsx");
const publicPage = read("app/account-deletion/page.tsx");
const settingsIndex = read("app/(app)/settings/page.tsx");

assert.match(migration, /enable row level security/i, "Deletion requests must be protected by RLS");
assert.match(migration, /revoke all .* from anon/i, "Anonymous users must not access deletion request records");
assert.match(migration, /user_id = \(select auth\.uid\(\)\)/i, "Users may only submit/read their own deletion requests");
assert.match(migration, /where status = 'pending'/i, "Only one pending deletion request may exist per user");

assert.match(api, /supabase\.auth\.getUser\(\)/, "Deletion requests must resolve the authenticated user server-side");
assert.doesNotMatch(api, /deleteUser|auth\.admin\.deleteUser|\.delete\(\)/, "Request submission must not immediately delete production data");
assert.match(api, /23505/, "Duplicate pending requests must be idempotent");

assert.match(settings, /Request account deletion|Solicitar eliminación de cuenta/, "The in-app deletion path must be user visible");
assert.match(settings, /\/api\/account\/deletion-request/, "The settings surface must submit through the authenticated request endpoint");
assert.match(publicPage, /Request account deletion/, "A public web deletion resource must exist for Play Console");
assert.match(publicPage, /\/settings\/account-deletion/, "The public resource must lead users into the deletion request flow");
assert.match(settingsIndex, /\/settings\/account-deletion/, "Account deletion must be discoverable from Settings");

console.log("B.O.S. account deletion store-readiness contract checks passed.");

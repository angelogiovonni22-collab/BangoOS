import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const route = readFileSync(join(root, "app", "api", "settings", "test-admin-invite", "route.ts"), "utf8");
const page = readFileSync(join(root, "app", "(app)", "settings", "test-admin-access", "page.tsx"), "utf8");
const client = readFileSync(join(root, "app", "(app)", "settings", "test-admin-access", "test-admin-access-client.tsx"), "utf8");

console.log("\nTest administrator access contract");
assert.match(route, /requireCompanyAdmin/, "only an existing company Owner/Administrator may provision test access");
assert.match(route, /role:\s*"administrator"/, "test account must receive the administrator role");
assert.match(route, /companySlug = `bos-test-/, "test company must use an isolated deterministic slug");
assert.match(route, /department:\s*"Test Administration"/, "test membership must be clearly marked");
assert.match(route, /permission_overrides:\s*\{\}/, "test administrator must use normal administrator permissions without hidden overrides");
assert.match(route, /No billing customer or subscription should be attached/, "test tenant must be explicitly non-billing");
assert.match(client, /Stripe customer or subscription/, "owner-facing UI must explicitly explain Stripe/billing isolation");
assert.match(route, /currentMemberships \|\| \[\]\)\.length > 0/, "any active existing B.O.S. membership must block test-workspace reassignment");
assert.match(route, /will not move or replace an existing workspace/, "existing real workspaces must be protected explicitly");
assert.match(route, /business_type:\s*"both"/, "test company must satisfy the production company business-type constraint");
assert.match(route, /orion_text_allowance:\s*200/, "test Orion text allowance must remain intentionally small");
assert.match(route, /orion_voice_minutes:\s*30/, "test Orion voice allowance must remain intentionally small");
assert.match(page, /initialEmail=\{first\(params\.email\)\}/, "prefill data must be server-derived without client effect churn");
assert.match(client, /Create Test Administrator/, "owner-facing test administrator action must be explicit");
assert.match(client, /without touching Bango Construction data/, "UI must explain company isolation");

console.log("B.O.S. test administrator access contract checks passed.");

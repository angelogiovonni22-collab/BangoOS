import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const migration = read("supabase/migrations/20260823033000_stripe_subscription_billing_foundation.sql");
const checkout = read("app/api/billing/checkout/route.ts");
const portal = read("app/api/billing/portal/route.ts");
const webhook = read("app/api/stripe/webhook/route.ts");
const stripeRest = read("lib/billing/stripe-rest.ts");
const page = read("app/(app)/settings/billing/page.tsx");

assert.match(migration, /enable row level security/);
assert.match(migration, /company_memberships/);
assert.match(migration, /role in \('owner', 'administrator'\)/);
assert.match(migration, /stripe_event_id text primary key/);
assert.doesNotMatch(migration, /grant .*bos_billing_webhook_events.*anon/i);
assert.match(checkout, /requireBillingAdministrator/);
assert.match(checkout, /mode: "subscription"/);
assert.match(checkout, /subscription_data\[metadata\]\[company_id\]/);
assert.match(portal, /requireBillingAdministrator/);
assert.match(webhook, /stripe-signature/);
assert.match(webhook, /verifyStripeSignature/);
assert.match(webhook, /code === "23505"/);
assert.match(page, /owner.*administrator/);
assert.match(stripeRest, /crypto\.subtle\.sign\("HMAC"/);
assert.match(stripeRest, /Math\.abs\(Date\.now\(\) \/ 1000 - parsedTimestamp\) > toleranceSeconds/);
assert.match(stripeRest, /timingSafeEqual/);

console.log("B.O.S. subscription billing contract checks passed.");

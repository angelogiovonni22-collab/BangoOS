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
assert.match(portal, /billing_portal\/sessions/, "Billing admins must be able to enter Stripe's self-service lifecycle portal");
assert.match(portal, /return_url: `\$\{origin\}\/settings\/billing`/, "Billing portal must return users to B.O.S. billing settings");

assert.match(webhook, /stripe-signature/);
assert.match(webhook, /verifyStripeSignature/);
assert.match(webhook, /code === "23505"/, "Webhook processing must be idempotent by Stripe event ID");
assert.match(webhook, /customer\.subscription\./, "Subscription create/update/delete lifecycle events must be processed");
assert.match(webhook, /status === "trialing"/, "Trial lifecycle must be represented");
assert.match(webhook, /status === "active"/, "Active subscription lifecycle must be represented");
assert.match(webhook, /status === "canceled"/, "Cancellation lifecycle must be represented");
assert.match(webhook, /status === "paused"/, "Paused subscription lifecycle must be represented");
assert.match(webhook, /cancel_at_period_end/, "Scheduled cancellation must remain visible in tenant billing state");
assert.match(webhook, /invoice\.paid/);
assert.match(webhook, /invoice\.payment_failed/, "Failed payment lifecycle must move the tenant into action-required/past-due state");
assert.match(webhook, /payment_method_status: paid \? "current" : "action_required"/);
assert.match(webhook, /seat_limit: plan\.seatLimit/, "Plan changes must refresh tenant seat entitlements");
assert.match(webhook, /orion_text_allowance: plan\.orionTextAllowance/, "Plan changes must refresh Orion text entitlements");
assert.match(webhook, /orion_voice_minutes: plan\.orionVoiceMinutes/, "Plan changes must refresh Orion voice entitlements");
assert.match(webhook, /processing_status: "failed"/, "Failed webhook processing must remain auditable");

assert.match(page, /owner.*administrator/);
assert.match(stripeRest, /crypto\.subtle\.sign\("HMAC"/);
assert.match(stripeRest, /Math\.abs\(Date\.now\(\) \/ 1000 - parsedTimestamp\) > toleranceSeconds/);
assert.match(stripeRest, /timingSafeEqual/);

console.log("B.O.S. subscription billing lifecycle contract checks passed.");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const ownerInvitePage = read("app/(app)/vendors/new/vendor-new-client.tsx");
const inviteRoute = read("app/api/trade-partners/invite/route.ts");
const claimRoute = read("app/api/trade-partners/invite/claim/route.ts");
const publicInvitePage = read("app/trade-partner-invite/trade-partner-invite-client.tsx");
const onboardingRoute = read("app/api/trade-partners/onboarding/route.ts");
const invitationHelpers = read("lib/trade-partners/invitations.ts");
const migration = read("supabase/migrations/20260829010000_trade_partner_invitation_intake.sql");

assert.match(ownerInvitePage, /Invite Trade Partner/);
assert.match(ownerInvitePage, /email address, mobile phone number, or both/i);
assert.match(ownerInvitePage, /Send Trade Partner Invitation/);
assert.match(ownerInvitePage, /Trade Partner completes their own company, trade, address, compliance, and account information/);
assert.doesNotMatch(ownerInvitePage, /<Field label="Payment terms"/i);
assert.doesNotMatch(ownerInvitePage, /<Field label="Credit limit"/i);
assert.doesNotMatch(ownerInvitePage, /<Field label="Account number"/i);
assert.doesNotMatch(ownerInvitePage, /<Field label="Quality rating/i);
assert.doesNotMatch(ownerInvitePage, /<Field label="Delivery rating/i);

assert.match(inviteRoute, /TP-\$\{String\(highest \+ 1\)\.padStart\(6, "0"\)\}/);
assert.match(inviteRoute, /status: "probation"/);
assert.match(inviteRoute, /trade_partner_invitations/);
assert.match(inviteRoute, /sendTradePartnerEmail/);
assert.match(inviteRoute, /sendTradePartnerSms/);
assert.match(inviteRoute, /Enter an email address, mobile phone number, or both/);

assert.match(migration, /create table if not exists public\.trade_partner_invitations/);
assert.match(migration, /token_hash text not null unique/);
assert.match(migration, /status in \('sent','opened','claimed','completed','expired','cancelled'\)/);
assert.doesNotMatch(migration, /to anon/);

assert.match(publicInvitePage, /Confirm your contact information/);
assert.match(publicInvitePage, /If your contractor invited you by phone only/);
assert.match(claimRoute, /generateLink\(\{ type: "invite"/);
assert.match(claimRoute, /Continue|account setup/i);
assert.match(claimRoute, /status: "claimed"/);

assert.match(invitationHelpers, /RESEND_API_KEY/);
assert.match(invitationHelpers, /TWILIO_ACCOUNT_SID/);
assert.match(invitationHelpers, /TWILIO_MESSAGING_SERVICE_SID/);
assert.match(invitationHelpers, /\/trade-partner-invite/);

assert.match(onboardingRoute, /status: "active"/);
assert.match(onboardingRoute, /New Trade Partner Added/);
assert.match(onboardingRoute, /completed Trade Partner onboarding and is ready for review/);
assert.match(onboardingRoute, /trade-partner-onboarding-complete:/);
assert.match(onboardingRoute, /status: "completed"/);

console.log("Trade Partner contact-first invitation and self-onboarding contract passed.");

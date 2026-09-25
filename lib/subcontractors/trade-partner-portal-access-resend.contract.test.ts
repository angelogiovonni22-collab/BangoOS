import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/projects/[id]/subcontractors/[assignmentId]/portal-access/route.ts", "utf8");
const client = readFileSync("components/projects/workspace/subcontractor-contract-actions.tsx", "utf8");

test("portal access endpoint creates a fresh secure Trade Partner invitation when needed", () => {
  assert.match(route, /company_memberships/);
  assert.match(route, /createTradePartnerInviteToken/);
  assert.match(route, /trade_partner_invitations/);
  assert.match(route, /sendTradePartnerEmail/);
  assert.match(route, /stage: "intake"/);
  assert.match(route, /alreadyActive/);
});

test("project subcontract controls can send or resend portal setup", () => {
  assert.match(client, /Send \/ Resend Portal Setup/);
  assert.match(client, /portal-access/);
  assert.match(client, /Secure Trade Partner portal setup email sent/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/projects/[id]/subcontractors/[assignmentId]/agreement/route.ts", "utf8");
const client = readFileSync("components/projects/workspace/subcontractor-contract-actions.tsx", "utf8");

test("sending a subcontract also provisions portal setup for a new Trade Partner", () => {
  assert.match(route, /company_memberships/);
  assert.match(route, /createTradePartnerInviteToken/);
  assert.match(route, /trade_partner_invitations/);
  assert.match(route, /sendTradePartnerEmail/);
  assert.match(route, /stage: "intake"/);
  assert.match(route, /portalSetup/);
});

test("project UI reports portal setup delivery", () => {
  assert.match(client, /secure Trade Partner account setup sent/);
  assert.match(client, /Trade Partner account setup email needs attention/);
});

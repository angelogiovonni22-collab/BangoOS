import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync("components/projects/workspace/project-trade-partners-workspace.tsx", "utf8");
const actions = readFileSync("components/projects/workspace/subcontractor-contract-actions.tsx", "utf8");
const service = readFileSync("lib/trade-partners/service.ts", "utf8");
const portal = readFileSync("app/api/projects/[id]/subcontractors/[assignmentId]/portal-access/route.ts", "utf8");

test("subcontractor workspace counts only current assignments", () => {
  assert.match(workspace, /currentAssignments/);
  assert.match(workspace, /Historical \/ Closed Assignments/);
  assert.match(workspace, /Signed Contracts/);
  assert.match(workspace, /Assigned Trade Partners/);
  assert.match(workspace, /Committed Cost/);
  assert.match(workspace, /Current Crew Size/);
  assert.match(workspace, /Not Yet Rated/);
  assert.match(workspace, /Awaiting Signature/);
  assert.doesNotMatch(workspace, /Authorized \/ Active/);
});

test("subcontractor cards keep secondary operations collapsed", () => {
  assert.match(actions, /Operations & Billing/);
  assert.match(actions, /Performance & Assignment Actions/);
  assert.match(actions, /Mobilization Requirements/);
  assert.match(actions, /open=\{openRequirements.length > 0\}/);
  assert.match(actions, /Mobilization Hold/);
  assert.match(actions, /blocking requirement/);
  assert.match(actions, /View Agreement/);
});

test("portal status replaces resend action after activation", () => {
  assert.match(portal, /export async function GET/);
  assert.match(actions, /Portal Active/);
  assert.match(actions, /portal\.pending \? "Resend Portal Setup"/);
});

test("service blocks duplicate current assignments even while inactive", () => {
  assert.match(service, /neq\("assignment_status", "archived"\)/);
  assert.match(service, /Edit or close that assignment instead of creating a duplicate/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("subcontractor foundation stores master agreements, project authorizations, audit evidence, and mobilization requirements", () => {
  const sql = read("supabase/migrations/20260815002000_subcontractor_contract_mobilization.sql");
  assert.match(sql, /subcontractor_master_agreements/);
  assert.match(sql, /project_subcontract_work_authorizations/);
  assert.match(sql, /subcontractor_signature_events/);
  assert.match(sql, /subcontractor_mobilization_requirements/);
  assert.match(sql, /refresh_subcontractor_mobilization_status/);
  assert.match(sql, /mobilization_status/);
  assert.match(sql, /revoke insert, update, delete .* authenticated/i);
});

test("project assignment can generate and email a secure subcontract package", () => {
  const route = read("app/api/projects/[id]/subcontractors/[assignmentId]/agreement/route.ts");
  assert.match(route, /buildMasterSnapshot/);
  assert.match(route, /buildWorkAuthorizationSnapshot/);
  assert.match(route, /randomBytes\(32\)/);
  assert.match(route, /sendContractEmail/);
  assert.match(route, /pending_signature/);
  assert.match(route, /refresh_subcontractor_mobilization_status/);
});

test("public subcontract portal requires explicit signer identity and consent", () => {
  const page = read("app/subcontracts/[token]/page.tsx");
  const route = read("app/api/subcontracts/[token]/route.ts");
  assert.match(page, /Accept & Sign Subcontract/);
  assert.match(page, /Full legal name/);
  assert.match(page, /Title \/ capacity/);
  assert.match(page, /consent to electronic records and signatures/);
  assert.match(route, /typedName/);
  assert.match(route, /consentAccepted/);
  assert.match(route, /authorization_hash/);
  assert.match(route, /subcontractor_signature_events/);
});

test("signing updates contract status but mobilization remains independently gated", () => {
  const route = read("app/api/subcontracts/[token]/route.ts");
  const mobilization = read("app/api/projects/[id]/subcontractors/[assignmentId]/mobilization/route.ts");
  assert.match(route, /contract_status: "signed"/);
  assert.match(route, /refresh_subcontractor_mobilization_status/);
  assert.match(mobilization, /w9/);
  assert.match(mobilization, /coi/);
  assert.match(mobilization, /workers_comp/);
  assert.match(mobilization, /licenses/);
  assert.match(mobilization, /safety_acknowledgement/);
});

test("project UI has reusable subcontract contract and mobilization controls", () => {
  const component = read("components/projects/workspace/subcontractor-contract-actions.tsx");
  assert.match(component, /Send Agreement/);
  assert.match(component, /Resend Agreement/);
  assert.match(component, /CLEARED TO MOBILIZE/);
  assert.match(component, /Mobilization Requirements/);
  assert.match(component, /Verify/);
  assert.match(component, /Waive/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync("lib/estimates/workflow-service.ts", "utf8");
const projectPage = readFileSync("app/(app)/projects/[id]/page.tsx", "utf8");

test("accepted estimate conversion carries deposit requirement to project", () => {
  assert.match(workflow, /required_down_payment: requiredDownPayment/);
  assert.match(workflow, /computeDepositAmount/);
  assert.match(workflow, /row\.project_id/);
});

test("project overview loads accepted estimate financial and scope terms", () => {
  assert.match(projectPage, /AcceptedEstimateSummary/);
  assert.match(projectPage, /payment_terms, customer_notes, scope_inclusions, scope_exclusions/);
  assert.match(projectPage, /Deposit Required/);
  assert.match(projectPage, /Contract Value/);
  assert.match(projectPage, /Scope Exclusions/);
  assert.match(projectPage, /View Accepted Estimate/);
});

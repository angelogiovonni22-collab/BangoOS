import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/(app)/estimates/[id]/page.tsx", "utf8");
const route = readFileSync("app/api/estimates/[id]/contract/route.ts", "utf8");

test("standard estimate detail no longer shows manual compliance panels", () => {
  assert.doesNotMatch(page, /EstimateComplianceSection/);
  assert.doesNotMatch(page, /HomeSolicitationCompliancePanel/);
});

test("sending an estimate is not blocked by manual compliance review gates", () => {
  assert.doesNotMatch(route, /CONTRACT_COMPLIANCE_BLOCKED/);
  assert.doesNotMatch(route, /HOME_SOLICITATION_COMPLIANCE_BLOCKED/);
  assert.doesNotMatch(route, /loadEstimateCompliance/);
  assert.doesNotMatch(route, /loadHomeSolicitationCompliance/);
});

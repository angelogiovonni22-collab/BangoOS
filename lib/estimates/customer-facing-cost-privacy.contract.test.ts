import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/contracts/estimate/[token]/route.ts", "utf8");
const constants = readFileSync("lib/estimates/constants.ts", "utf8");

test("customer estimate API explicitly whitelists public line-item fields", () => {
  assert.match(route, /function sanitizePublicEstimateLineItem/);
  assert.match(route, /description:/);
  assert.match(route, /quantity:/);
  assert.match(route, /unit:/);
  assert.match(route, /unit_price:/);
  assert.match(route, /line_total:/);
  assert.match(route, /sort_order:/);
  assert.match(route, /signedSnapshot\.estimate\.lineItems\.map/);
});

test("subcontractor category is visibly marked internal in the estimate builder", () => {
  assert.match(constants, /Trade Partner Cost \(Internal\)/);
  assert.doesNotMatch(constants, /label: "Subcontractors"/);
});

const tradePartnerWorkspace = readFileSync("components/projects/workspace/project-trade-partners-workspace.tsx", "utf8");

test("project trade-partner workflow clearly owns internal subcontract costs", () => {
  assert.match(tradePartnerWorkspace, /Scope of Work/);
  assert.match(tradePartnerWorkspace, /Amount We Are Paying \(Internal\)/);
  assert.match(tradePartnerWorkspace, /Internal subcontract cost/);
  assert.match(tradePartnerWorkspace, /never shown to the customer|never shown on customer-facing estimates or invoices/);
});

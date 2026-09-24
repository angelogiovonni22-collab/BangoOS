import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync("components/estimates/estimate-detail.tsx", "utf8");
const previewButton = readFileSync("components/estimates/preview-estimate-button.tsx", "utf8");
const previewRoute = readFileSync("app/api/estimates/[id]/preview/route.ts", "utf8");
const contractRoute = readFileSync("app/api/contracts/estimate/[token]/route.ts", "utf8");
const customerPage = readFileSync("app/contracts/estimate/[token]/page.tsx", "utf8");

test("estimate detail exposes a customer preview before send", () => {
  assert.match(detail, /PreviewEstimateButton/);
  assert.match(previewButton, /Preview as Customer/);
  assert.match(previewButton, /\/api\/estimates\/\$\{estimateId\}\/preview/);
});

test("preview token is short-lived, read-only, and does not mark the estimate sent", () => {
  assert.match(previewRoute, /purpose: "customer_preview"/);
  assert.match(previewRoute, /2 \* 60 \* 60 \* 1000/);
  assert.doesNotMatch(previewRoute, /public_token_last_issued_at/);
  assert.doesNotMatch(previewRoute, /status: "sent"/);
  assert.match(contractRoute, /Customer preview links are read-only and cannot be signed/);
});

test("customer preview uses the actual customer document while hiding acceptance controls", () => {
  assert.match(customerPage, /Customer preview · Read only/);
  assert.match(customerPage, /Acceptance is disabled in preview mode/);
  assert.match(customerPage, /contract\.preview/);
});

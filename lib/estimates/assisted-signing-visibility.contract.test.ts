import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/(app)/estimates/[id]/page.tsx", "utf8");

test("standard estimate detail hides seller assisted signing while keeping compliance review", () => {
  assert.doesNotMatch(page, /HomeSolicitationSellerSignature/);
  assert.match(page, /HomeSolicitationCompliancePanel/);
});

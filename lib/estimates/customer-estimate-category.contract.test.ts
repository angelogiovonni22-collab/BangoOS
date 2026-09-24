import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/contracts/estimate/[token]/route.ts", "utf8");
const page = readFileSync("app/contracts/estimate/[token]/page.tsx", "utf8");

test("customer estimate API safely exposes line-item category", () => {
  assert.match(route, /category: String\(item\.category/);
  assert.match(route, /select\("category, description, quantity, unit, unit_price, line_total, sort_order"\)/);
});

test("customer estimate displays category before description", () => {
  assert.match(page, />Category<\/th><th[^>]*>Description<\/th>/);
  assert.match(page, /categoryLabel\(item\.category\)/);
  assert.match(page, /labor: "Labor"/);
  assert.match(page, /materials: "Materials"/);
});

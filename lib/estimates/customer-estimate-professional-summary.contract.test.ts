import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const constants = readFileSync("lib/estimates/constants.ts", "utf8");
const detail = readFileSync("components/estimates/estimate-detail.tsx", "utf8");
const route = readFileSync("app/api/contracts/estimate/[token]/route.ts", "utf8");
const page = readFileSync("app/contracts/estimate/[token]/page.tsx", "utf8");

test("lump sum is presented as Total in estimate editing and detail views", () => {
  assert.match(constants, /value: "lump_sum", label: "Total"/);
  assert.match(detail, /lineItem\.unit === "lump_sum" \? "Total"/);
});

test("customer estimate includes customer-safe pricing breakdown including tax", () => {
  assert.match(route, /subtotal, discount_total, tax_rate, tax_amount, additional_fee/);
  assert.match(page, /Tax \(\$\{\(contract\.estimate\.tax_rate \* 100\)/);
  assert.match(page, /Estimate total/);
});

test("customer preview presents lump sum rows as Total and adds estimate dates", () => {
  assert.match(page, /quantityLabel/);
  assert.match(page, /"Total"/);
  assert.match(page, /Estimate date/);
  assert.match(page, /Valid through/);
});

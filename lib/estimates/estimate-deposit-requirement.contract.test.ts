import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const types = readFileSync("lib/estimates/types.ts", "utf8");
const form = readFileSync("components/estimates/estimate-form.tsx", "utf8");
const totals = readFileSync("components/estimates/estimate-totals.tsx", "utf8");
const service = readFileSync("lib/estimates/service.ts", "utf8");
const route = readFileSync("app/api/contracts/estimate/[token]/route.ts", "utf8");
const page = readFileSync("app/contracts/estimate/[token]/page.tsx", "utf8");
const workflow = readFileSync("lib/estimates/workflow-service.ts", "utf8");

test("estimate form supports no deposit, percentage, and fixed amount", () => {
  assert.match(types, /EstimateDepositType = "none" \| "percentage" \| "fixed"/);
  assert.match(form, /depositType: "none"/);
  assert.match(totals, /Percent of Contract/);
  assert.match(totals, /Fixed Amount/);
  assert.match(totals, /Customer Deposit Requirement/);
});

test("deposit requirement is persisted and customer-facing", () => {
  assert.match(service, /deposit_type: params\.values\.depositType/);
  assert.match(service, /deposit_value: Number\(params\.values\.depositValue/);
  assert.match(route, /deposit_type, deposit_value, deposit_amount/);
  assert.match(page, /Deposit required/);
  assert.match(page, /depositLabel/);
});

test("signed agreement snapshot preserves deposit requirement", () => {
  assert.match(workflow, /depositType: estimate\.deposit_type/);
  assert.match(workflow, /depositValue: Number\(estimate\.deposit_value/);
  assert.match(workflow, /depositAmount: computeDepositAmount/);
});

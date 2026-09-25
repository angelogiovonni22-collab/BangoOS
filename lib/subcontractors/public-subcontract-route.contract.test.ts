import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/subcontracts/[token]/route.ts", "utf8");

test("public subcontract route uses current vendor schema", () => {
  assert.match(route, /display_name,company_name,first_name,last_name,email/);
  assert.match(route, /vendor\.display_name/);
  assert.doesNotMatch(route, /select\("name,company_name,first_name,last_name,email"\)/);
  assert.doesNotMatch(route, /vendor\.name/);
});

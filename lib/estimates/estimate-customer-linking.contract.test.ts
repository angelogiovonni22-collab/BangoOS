import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync("components/estimates/estimate-form.tsx", "utf8");

test("prospect estimates auto-link to an existing customer by exact normalized email", () => {
  assert.match(form, /prospectEmail = prospect\.email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(form, /customerOptions\.find/);
  assert.match(form, /effectiveValues = matchedCustomer/);
  assert.match(form, /values: effectiveValues/);
});

test("matched customer estimates do not retain a duplicate prospect record", () => {
  assert.match(form, /effectiveValues\.customerId[\s\S]*removeEstimateProspect/);
});

test("Save Changes returns to estimate detail while Save and Continue Editing stays in edit mode", () => {
  assert.match(form, /if \(action === "continue"\)/);
  assert.match(form, /\/edit/);
  assert.match(form, /router\.push\(`/);
});

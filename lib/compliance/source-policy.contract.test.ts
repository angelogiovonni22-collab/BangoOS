import fs from "node:fs";
import assert from "node:assert/strict";
const policy = fs.readFileSync("docs/compliance/SOURCE_POLICY.md", "utf8");
assert.match(policy, /primary law|official agency/i);
assert.match(policy, /effective-date/i);
assert.match(policy, /REVIEW_REQUIRED/);
console.log("Compliance source policy contract passed.");

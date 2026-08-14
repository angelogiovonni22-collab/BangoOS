import fs from "node:fs";
import assert from "node:assert/strict";
const text = fs.readFileSync("docs/compliance/LEGAL_REVIEW_BOUNDARY.md", "utf8");
assert.match(text, /REVIEW_REQUIRED/);
assert.match(text, /must not represent/i);
assert.match(text, /auditable/i);
console.log("Legal review boundary contract passed.");

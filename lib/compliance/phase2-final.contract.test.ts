import fs from "node:fs";
import assert from "node:assert/strict";
const text = fs.readFileSync("docs/compliance/PHASE2_FINAL.md", "utf8");
assert.match(text, /completes the Ohio home-solicitation phase/i);
assert.match(text, /Phase 3/);
console.log("Phase 2 final scope contract passed.");

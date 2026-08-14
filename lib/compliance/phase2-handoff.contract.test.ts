import fs from "node:fs";
import assert from "node:assert/strict";
const handoff = fs.readFileSync("docs/compliance/PHASE2_HANDOFF.md", "utf8");
assert.match(handoff, /Phase 2 implementation is complete/);
assert.match(handoff, /Phase 3/);
console.log("Phase 2 handoff contract passed.");

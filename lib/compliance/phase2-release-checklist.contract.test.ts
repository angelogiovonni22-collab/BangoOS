import fs from "node:fs";
import assert from "node:assert/strict";
const checklist = fs.readFileSync("docs/compliance/PHASE2_RELEASE_CHECKLIST.md", "utf8");
assert.doesNotMatch(checklist, /- \[ \]/, "Phase 2 release checklist must not contain unfinished items before merge");
assert.match(checklist, /CI passes/);
console.log("Phase 2 release checklist contract passed.");

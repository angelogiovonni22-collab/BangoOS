import fs from "node:fs";
import assert from "node:assert/strict";
assert.equal(fs.readFileSync("docs/compliance/PHASE2_VERSION.txt", "utf8").trim(), "ohio-home-solicitation-phase2-v1");
console.log("Phase 2 version marker passed.");

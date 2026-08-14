import fs from "node:fs";
import assert from "node:assert/strict";
const spec = fs.readFileSync("docs/compliance/PHASE3_CONTRACT_ASSEMBLY.md", "utf8");
for (const phrase of ["agreement snapshot","cancellation notice","ruleset/version","hash-covered","blocks assembly/send","one primary review/sign action"]) {
  assert.match(spec, new RegExp(phrase, "i"));
}
console.log("Phase 3 contract assembly specification passed.");

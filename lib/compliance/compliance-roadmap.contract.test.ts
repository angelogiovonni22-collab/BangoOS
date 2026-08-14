import fs from "node:fs";
import assert from "node:assert/strict";
const roadmap = fs.readFileSync("docs/compliance/COMPLIANCE_ROADMAP.md", "utf8");
for (const phrase of ["Contract document assembly","Payment/deposit controls","Change-order controls","Operational start controls","Evidence center","Jurisdiction packs","Counsel review workflow"]) {
  assert.match(roadmap, new RegExp(phrase, "i"), `roadmap must retain ${phrase}`);
}
console.log("Contract compliance roadmap contract passed.");

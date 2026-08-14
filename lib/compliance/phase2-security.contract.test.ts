import fs from "node:fs";
import assert from "node:assert/strict";
const text = fs.readFileSync("docs/compliance/PHASE2_SECURITY.md", "utf8");
for (const phrase of ["validated secure contract token","RLS","Server-side","indefinite compliance hold","never when cancellation is recorded"]) assert.match(text, new RegExp(phrase, "i"));
console.log("Phase 2 security contract passed.");

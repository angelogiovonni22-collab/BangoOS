import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),surface=readFileSync(resolve(root,"components/crews/mobile-field-inspections.tsx"),"utf8"),workspace=readFileSync(resolve(root,"components/crews/mobile-field-operations-workspace.tsx"),"utf8");
assert.match(surface,/rows\.some\(\(row\) => String\(row\.id\) === current\)/);
assert.match(surface,/setChecklist\(\{ workArea: false, ppe: false, access: false, housekeeping: false \}\)/);
assert.match(workspace,/<MobileFieldInspections key=\{selectedCrewAssignments\[0\]\?\.projectId \|\| "unassigned"\}/);

console.log("Mobile inspection project context contract checks passed.");

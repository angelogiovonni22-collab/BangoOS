import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const time = readFileSync(resolve(root, "lib/crews/workforce-time.ts"), "utf8");
const approvals = readFileSync(resolve(root, "components/crews/mobile-time-approvals.tsx"), "utf8");
const inspections = readFileSync(resolve(root, "components/crews/mobile-field-inspections.tsx"), "utf8");

assert.match(time, /clock_in_location, clock_out_location/);
assert.match(time, /db\.from\("projects"\).*\.eq\("company_id",workspace\.context\.companyId\)/);
assert.match(time, /if\(!result\.data\)throw new Error\("This time entry was already reviewed/);
assert.match(approvals, /decisionRef=useRef\(""\)/);
assert.match(approvals, /if\(decisionRef\.current\)return/);
assert.match(approvals, /Location evidence:/);
assert.match(approvals, /row\.projectName/);
assert.match(inspections, /mutationRef = useRef\(false\)/);
assert.match(inspections, /if \(!selectedId \|\| mutationRef\.current\) return/);

console.log("Mobile field approval reliability contract checks passed.");

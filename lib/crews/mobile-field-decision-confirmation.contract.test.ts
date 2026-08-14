import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),confirmation=readFileSync(resolve(root,"components/crews/mobile-field-confirm-action.tsx"),"utf8"),time=readFileSync(resolve(root,"components/crews/mobile-time-approvals.tsx"),"utf8"),inspection=readFileSync(resolve(root,"components/crews/mobile-field-inspections.tsx"),"utf8");
assert.match(confirmation,/role="group"/);
assert.match(confirmation,/role="alert"/);
assert.match(confirmation,/Confirm/);
assert.match(confirmation,/>Cancel</);
assert.match(time,/confirmLabel="Confirm rejection"/);
assert.match(time,/onConfirm=\{\(\)=>decide\(row\.id,"rejected"\)\}/);
assert.match(inspection,/confirmLabel="Confirm failure"/);
assert.match(inspection,/onConfirm=\{\(\)=>approve\("failed"\)\}/);

console.log("Mobile field decision confirmation contract checks passed.");

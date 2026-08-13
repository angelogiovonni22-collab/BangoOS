import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source=readFileSync(resolve(process.cwd(),"components/crews/mobile-field-operations-workspace.tsx"),"utf8");
assert.match(source,/pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\]/);
assert.match(source,/<nav aria-label="Field quick actions"/);
assert.match(source,/pb-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/);

console.log("Mobile field safe-area contract checks passed.");

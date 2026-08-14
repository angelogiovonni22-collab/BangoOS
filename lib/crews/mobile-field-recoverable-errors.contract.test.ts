import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source=readFileSync(resolve(process.cwd(),"components/crews/mobile-field-operations-workspace.tsx"),"utf8");
assert.match(source,/if \(errorMessage && !data\)/);
assert.match(source,/role="alert"/);
assert.match(source,/\{errorMessage\}/);
assert.match(source,/>Retry<\/Button>/);
assert.match(source,/onClick=\{\(\)=>void refresh\(\)\}/);

console.log("Mobile field recoverable error contract checks passed.");

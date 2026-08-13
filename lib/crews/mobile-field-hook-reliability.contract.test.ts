import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source=readFileSync(resolve(process.cwd(),"lib/crews/use-mobile-field-operations.ts"),"utf8");
assert.match(source,/mutationRef = useRef\(false\)/);
assert.match(source,/if\(mutationRef\.current\)return false/);
assert.match(source,/if\(mutationRef\.current\)return null/);
assert.match(source,/mutationRef\.current=true/);
assert.match(source,/mutationRef\.current=false/);
assert.match(source,/refreshRequestRef = useRef\(0\)/);
assert.match(source,/requestId===refreshRequestRef\.current/);
assert.match(source,/error instanceof Error\?error\.message/);

console.log("Mobile field hook reliability contract checks passed.");

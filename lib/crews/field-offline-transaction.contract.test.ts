import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source=readFileSync(resolve(process.cwd(),"lib/crews/field-offline-queue.ts"),"utf8");
assert.match(source,/transaction\.oncomplete = \(\) => \{ database\.close\(\); resolve\(result\); \}/);
assert.match(source,/transaction\.onerror = \(\) => \{ database\.close\(\); reject/);
assert.match(source,/transaction\.onabort = \(\) => \{ database\.close\(\); reject/);
assert.match(source,/request\.onblocked/);
assert.match(source,/onversionchange = \(\) => request\.result\.close\(\)/);

console.log("Field offline transaction contract checks passed.");

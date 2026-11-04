import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),clock=readFileSync(resolve(root,"components/crews/mobile-workforce-time-clock.tsx"),"utf8"),hook=readFileSync(resolve(root,"lib/crews/use-mobile-field-operations.ts"),"utf8"),workspace=readFileSync(resolve(root,"components/crews/mobile-field-operations-workspace.tsx"),"utf8");
assert.match(clock,/mutationRef\s*=\s*useRef\(false\)/);
assert.match(clock,/if\s*\(!hasSelectedEmployee\s*\|\|\s*mutationRef\.current\)\s*return/);
assert.match(clock,/parsedBreak\s*<\s*0\s*\|\|\s*parsedBreak\s*>\s*1440/);
assert.match(clock,/with location evidence/);
assert.match(clock,/without location evidence/);
assert.match(hook,/addEventListener\("offline", markOffline\)/);
assert.match(hook,/removeEventListener\("offline", markOffline\)/);
assert.match(workspace,/Offline · field actions remain safely queued/);
assert.match(workspace,/<MobileWorkforceTimeClock key=/);

console.log("Mobile time clock reliability contract checks passed.");

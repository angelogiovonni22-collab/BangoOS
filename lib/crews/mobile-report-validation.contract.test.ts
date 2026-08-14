import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),validation=readFileSync(resolve(root,"lib/crews/mobile-report-validation.ts"),"utf8"),surface=readFileSync(resolve(root,"components/crews/mobile-field-operations-workspace.tsx"),"utf8"),service=readFileSync(resolve(root,"lib/crews/mobile-field-operations-service.ts"),"utf8");
for(const phrase of["Add field activity","Delay duration","delay's schedule or cost impact","delay corrective action","Material quantity","Material unit","Material supplier","Safety attendees","immediate action for serious safety events"])assert.match(validation,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
assert.match(surface,/const reportReady = reportErrors\.length===0/);
assert.match(surface,/Complete before final submission:/);
assert.match(surface,/disabled=\{isMutating \|\| !effectiveCrewId \|\| !reportDate\}/);
assert.match(surface,/!reportReady/);
assert.match(service,/if\(input\.status!=="draft"\)/);

console.log("Mobile report validation contract checks passed.");

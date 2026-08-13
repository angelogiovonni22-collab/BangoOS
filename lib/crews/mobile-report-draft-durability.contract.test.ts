import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),store=readFileSync(resolve(root,"lib/crews/mobile-report-drafts.ts"),"utf8"),surface=readFileSync(resolve(root,"components/crews/mobile-field-operations-workspace.tsx"),"utf8");
assert.match(store,/indexedDB\.open\(DATABASE_NAME,DATABASE_VERSION\)/);
assert.match(store,/`\$\{scope\.companyId\}:\$\{scope\.userId\}:\$\{crewId\}:\$\{reportDate\}`/);
assert.match(store,/tx\.oncomplete=.*resolve\(result\)/);
assert.match(surface,/reportDraftHydrationRef/);
assert.match(surface,/reportDraftStore\.load\(effectiveCrewId,reportDate\)/);
assert.match(surface,/reportDraftStore\.save\(effectiveCrewId,reportDate,mobileReport\)/);
assert.match(surface,/await reportDraftStore\.remove\(effectiveCrewId,reportDate\)/);
assert.match(surface,/const timer=window\.setTimeout/);

console.log("Mobile report draft durability contract checks passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),store=readFileSync(resolve(root,"lib/crews/mobile-checklist-drafts.ts"),"utf8"),surface=readFileSync(resolve(root,"components/crews/mobile-field-operations-workspace.tsx"),"utf8");
assert.match(store,/indexedDB\.open\(DATABASE_NAME,DATABASE_VERSION\)/);
assert.match(store,/`\$\{scope\.companyId\}:\$\{scope\.userId\}:\$\{crewId\}`/);
assert.match(surface,/checklistDraftHydrationRef/);
assert.match(surface,/checklistDraftStore\.load\(effectiveCrewId\)/);
assert.match(surface,/checklistDraftStore\.save\(effectiveCrewId,checklistDraftByCrewId\[effectiveCrewId\]\)/);
assert.match(surface,/await checklistDraftStore\.remove\(effectiveCrewId\)/);
assert.match(surface,/delete next\[effectiveCrewId\]/);
assert.match(surface,/onClick=\{\(\) => void persistChecklist\(\)\}/);

console.log("Mobile checklist draft durability contract checks passed.");

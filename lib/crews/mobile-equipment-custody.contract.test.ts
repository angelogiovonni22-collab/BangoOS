import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),service=readFileSync(resolve(root,"lib/crews/mobile-field-operations-service.ts"),"utf8"),surface=readFileSync(resolve(root,"components/crews/mobile-field-operations-workspace.tsx"),"utf8");
assert.match(service,/new Set\(input\.equipmentIds\.map\(\(id\) => id\.trim\(\)\)\.filter\(Boolean\)\)/);
assert.match(service,/Choose a crew and at least one equipment ID/);
assert.match(service,/This equipment checkout is no longer active/);
assert.match(surface,/const equipmentIds = useMemo/);
assert.match(surface,/const assignEquipment = async/);
assert.match(surface,/setEquipmentIdsInput\(""\)/);
assert.match(surface,/const completeEquipmentReturn = async/);
assert.match(surface,/setReturnCheckoutId\(""\)/);
assert.match(surface,/aria-label="Equipment checkout to return"/);

console.log("Mobile equipment custody contract checks passed.");

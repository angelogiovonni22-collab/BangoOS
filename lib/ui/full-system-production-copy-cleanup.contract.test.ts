import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

const customers = read("app/(app)/customers/page.tsx");
const equipmentList = read("app/(app)/equipment/equipment-list-client.tsx");
const equipmentDetail = read("app/(app)/equipment/[id]/equipment-detail-client.tsx");
const workforceBoard = read("components/operations/workforce-board.tsx");

assert.ok(!customers.includes('"Coming Soon"'), "customer KPIs must not expose placeholder copy in Production");
assert.ok(customers.includes('label="Archived Customers"'), "customer KPI strip uses a live archived-customer count instead of a placeholder metric");

assert.ok(!equipmentList.includes("Phase 1"), "equipment list must not expose internal phase language");
assert.ok(!equipmentList.includes("relationship tables"), "equipment list must not expose implementation-table language");
assert.ok(!equipmentDetail.includes("Phase 1"), "equipment detail must not expose internal phase language");
assert.ok(!equipmentDetail.includes("not yet present"), "equipment detail must not expose missing-table implementation language");
assert.ok(!equipmentDetail.includes("dedicated history tables"), "equipment detail must not expose internal storage architecture");
assert.ok(!equipmentDetail.includes('value="Not configured"'), "equipment detail uses user-facing empty-state copy instead of configuration jargon");

assert.ok(!workforceBoard.includes("live service yet"), "workforce partial-data notice must not expose backend-service implementation language");

console.log("+ full-system Production copy cleanup invariants hold");

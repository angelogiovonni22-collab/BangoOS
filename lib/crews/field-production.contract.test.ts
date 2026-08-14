import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeFieldProduction } from "./field-production";

const valid = normalizeFieldProduction({ activity: "Installed corridor framing", quantity: "184.5", unit: "LF", percentComplete: "75" });
assert.deepEqual(valid, { activity: "Installed corridor framing", quantity: 184.5, unit: "LF", percentComplete: 75 });
assert.equal(normalizeFieldProduction({ activity: "Work", quantity: "0", unit: "EA", percentComplete: "50" }), null);
assert.equal(normalizeFieldProduction({ activity: "Work", quantity: "2", unit: "", percentComplete: "101" }), null);

const root = process.cwd();
const service = readFileSync(resolve(root, "lib/crews/mobile-field-operations-service.ts"), "utf8");
const workspace = readFileSync(resolve(root, "components/crews/mobile-field-operations-workspace.tsx"), "utf8");
assert.match(service, /normalizeFieldProduction/);
assert.match(service, /milestoneCompleted: production\.percentComplete === 100/);
assert.match(workspace, /Production quantity/);
assert.match(workspace, /Production unit/);
assert.match(workspace, /Production percent complete/);
assert.match(workspace, /!productionValid/);
console.log("Field production tracking contract checks passed.");

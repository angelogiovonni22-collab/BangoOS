import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
const workspace = read("../../components/crews/mobile-field-operations-workspace.tsx");
const service = read("./mobile-field-operations-service.ts");
const workforceService = read("./workforce-operations-service.ts");

assert.match(workforceService, /assignedCrewId: employee\.primaryCrewId/, "crew identity must originate from the scoped employee directory");
assert.match(workforceService, /assignedProjectId: employee\.currentProjectId \|\| assignment\?\.scope\.projectId \|\| null/, "project identity must use stable IDs");
assert.match(service, /crewId: employee\.assignedCrewId/, "mobile directory rows must preserve crew IDs");
assert.match(service, /projectId: employee\.assignedProjectId/, "mobile directory rows must preserve project IDs");
assert.match(workspace, /href={`\/crews\/\$\{employee\.crewId\}`}/, "crew links must target the employee's crew, not the currently selected crew");
assert.match(workspace, /href={`\/projects\/\$\{employee\.projectId\}`}/, "project links must target the employee's assigned project");
assert.doesNotMatch(workspace, /href={`\/crews\/\$\{effectiveCrewId\}`}/, "directory links must not route every employee to the selected crew");

console.log("mobile crew directory routing contract passed");

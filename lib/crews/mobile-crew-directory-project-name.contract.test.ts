import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("./workforce-operations-service.ts", import.meta.url)), "utf8");

assert.match(
  source,
  /assignedJobName: employee\.currentProjectName \|\| assignment\?\.scope\.projectName \|\| null/,
  "mobile directory project labels must come from project names",
);
assert.doesNotMatch(
  source,
  /assignedJobName: employee\.currentAssignmentTitle \|\| assignment\?\.title/,
  "task or assignment titles must not be presented as project names",
);

console.log("mobile crew directory project-name contract passed");

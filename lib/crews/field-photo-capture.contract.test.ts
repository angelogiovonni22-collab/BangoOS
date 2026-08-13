import assert from "node:assert/strict";import{readFileSync}from"node:fs";import{resolve}from"node:path";
const source=readFileSync(resolve(process.cwd(),"components/crews/field-photo-capture.tsx"),"utf8");
assert.match(source,/capture="environment"/);assert.match(source,/resolveWorkspaceContext/);assert.match(source,/company_id: workspace\.context\.companyId/);assert.match(source,/project_id: projectId/);assert.match(source,/storage\.from\(BUCKET\)\.remove/);assert.match(source,/captured_at: new Date\(\)\.toISOString\(\)/);
console.log("Field photo capture contract checks passed.");

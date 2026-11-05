import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("components/crews/field-photo-capture.tsx","utf8");
const upload=readFileSync("lib/crews/field-photo-upload.ts","utf8");
assert.match(source,/capture="environment"/);
assert.match(source,/resolveWorkspaceContext/);
assert.match(source,/\.eq\("company_id", scope.companyId\)\.eq\("project_id", projectId\)/);
assert.match(source,/upsert: false/);
assert.doesNotMatch(source,/storage\.from\([^)]*\)\.remove\(/);
assert.match(upload,/capturedAt: legacy\?\.captured_at \?\? new Date\(\)\.toISOString\(\)/);
console.log("Field photo capture contract checks passed.");


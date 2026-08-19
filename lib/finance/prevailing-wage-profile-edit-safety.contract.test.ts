import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "app/(app)/invoices/prevailing-wage/setup/page.tsx"), "utf8");

assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\("projectId"\)/, "setup should accept a projectId deep link");
assert.match(source, /prevailing_wage_project_profiles[\s\S]*\.eq\("project_id", projectId\)[\s\S]*\.maybeSingle\(\)/, "setup must load an existing project profile before edits");
assert.match(source, /setDeterminationNumber\(profile\.determination_number \|\| ""\)/, "setup must hydrate saved determination data");
assert.match(source, /created_by: existingCreatedBy \|\| workspace\.userId/, "setup must preserve the original profile creator when available");
assert.match(source, /disabled=\{isSaving \|\| isLoadingProfile\}/, "setup must block saves while an existing profile is loading");

console.log("Prevailing wage profile edit safety contract passed.");

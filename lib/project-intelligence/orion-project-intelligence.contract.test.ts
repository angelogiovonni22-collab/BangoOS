import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const api = read("app/api/projects/[id]/intelligence/route.ts");
const workspace = read("components/projects/workspace/project-intelligence-workspace.tsx");
const documents = read("components/projects/workspace/project-documents-workspace.tsx");
const migration = read("supabase/migrations/20260822151000_orion_project_intelligence.sql");

assert.match(documents, /ProjectIntelligenceWorkspace/, "Project Documents must expose Orion Project Intelligence.");
assert.match(workspace, /project intelligence workspace/, "Intelligence UI must expose stable Orion semantics.");
assert.match(workspace, /data-orion-action={`analyze-\$\{source\.sourceKey\}`}/, "Evidence analysis actions must be semantically operable by Orion.");
assert.match(workspace, /Risks to verify/, "AI findings must frame risks as items requiring verification.");
assert.match(workspace, /does not claim it created operational records/, "UI must preserve the action-verification boundary.");

assert.match(api, /eq\("company_id", workspace\.context\.companyId\)/, "Project intelligence must enforce tenant scope before loading project data.");
assert.match(api, /sourceType === "project"/, "Project-level briefing must be supported.");
assert.match(api, /ANALYZABLE_IMAGE_TYPES/, "Photo and image evidence must use an explicit supported MIME allowlist.");
assert.match(api, /mimeType === "application\/pdf"/, "Text-readable PDFs must be supported.");
assert.match(api, /MAX_ANALYSIS_BYTES/, "AI source downloads must enforce a size boundary.");
assert.match(api, /Never invent dimensions, quantities, completion percentages, defects, code violations, contract terms, or costs/, "Prompt must forbid construction hallucinations.");
assert.match(api, /Never claim that B\.O\.S\. already created a task, RFI, change order, punch item, or note/, "Prompt must preserve the operational action boundary.");
assert.match(api, /project_intelligence_artifacts/, "Analyses must be persisted with project scope.");
assert.match(api, /created_by: workspace\.userId/, "Saved intelligence must be attributable to the authenticated user.");

assert.match(migration, /enable row level security/, "Project intelligence persistence must enable RLS.");
assert.match(migration, /revoke all on public\.project_intelligence_artifacts from anon/, "Anonymous access must be explicitly revoked.");
assert.match(migration, /p\.id = auth\.uid\(\) and p\.company_id = project_intelligence_artifacts\.company_id/, "RLS must bind authenticated users to their company.");
assert.match(migration, /pr\.id = project_intelligence_artifacts\.project_id and pr\.company_id = project_intelligence_artifacts\.company_id/, "RLS must verify project/company ownership.");
assert.match(migration, /created_by = auth\.uid\(\)/, "Insert policy must prevent author spoofing.");

console.log("Orion Project Intelligence contract passed.");

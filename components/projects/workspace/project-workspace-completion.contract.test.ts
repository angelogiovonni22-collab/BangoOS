import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/(app)/projects/[id]/page.tsx", "utf8");
const linkedWorkspace = readFileSync("components/projects/workspace/project-linked-module-workspace.tsx", "utf8");
const documentsWorkspace = readFileSync("components/projects/workspace/project-documents-workspace.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260822205000_project_workspace_register_creation.sql", "utf8");

for (const component of ["ProjectDocumentsWorkspace", "ProjectActivityWorkspace", "ProjectLinkedModuleWorkspace"]) {
  assert.match(page, new RegExp(`<${component}`), `${component} must be directly mounted by the project page`);
}

for (const tab of ["daily_logs", "crew", "change_orders", "rfis", "submittals"]) {
  assert.match(page, new RegExp(`"${tab}"`), `${tab} must be part of the live project workspace`);
}
assert.match(page, /const validTabs:[\s\S]*?"submittals"[\s\S]*?"inspections"/);

assert.match(linkedWorkspace, /\.eq\("project_id", projectId\)/);
assert.match(linkedWorkspace, /create_project_rfi/);
assert.match(linkedWorkspace, /create_project_submittal/);
assert.match(linkedWorkspace, /projectName=\$\{encodeURIComponent\(projectName\)\}/);
assert.match(linkedWorkspace, /T12:00:00/);
assert.match(documentsWorkspace, /ProjectReceiptsWorkspace/);
assert.match(migration, /pg_advisory_xact_lock\(hashtext\('project-rfi:'/);
assert.match(migration, /pg_advisory_xact_lock\(hashtext\('project-submittal:'/);
assert.match(migration, /public\.has_company_role/);
assert.match(migration, /public\.blueprint_project_belongs_to_company/);
assert.match(migration, /'rfi\.created'/);
assert.match(migration, /'submittal\.created'/);

console.log("Project workspace completion contract passed.");

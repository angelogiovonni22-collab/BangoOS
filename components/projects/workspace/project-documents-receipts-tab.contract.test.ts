import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const documentsWorkspace = fs.readFileSync(path.join(root, "components/projects/workspace/project-documents-workspace.tsx"), "utf8");
const placeholder = fs.readFileSync(path.join(root, "components/projects/workspace/project-command-center-tab-placeholder.tsx"), "utf8");

assert.match(documentsWorkspace, /label: "Receipts"/);
assert.match(documentsWorkspace, /data-orion-action={`project-documents-tab-\$\{section\.key\}`}/);
assert.match(documentsWorkspace, /<ProjectReceiptsWorkspace projectId=\{projectId\} \/>/);
assert.match(documentsWorkspace, /<ProjectLinkedModuleWorkspace projectId=\{projectId\} tab="documents" localeTag=\{localeTag\} \/>/);
assert.match(placeholder, /linkedTab === "documents"/);
assert.match(placeholder, /<ProjectDocumentsWorkspace projectId=\{projectId\} localeTag=\{localeTag\} \/>/);

console.log("Project documents receipts tab contract passed.");

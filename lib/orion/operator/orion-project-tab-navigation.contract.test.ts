import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspaceNavigation = fs.readFileSync(path.join(root, "components/workspace/workspace-navigation.tsx"), "utf8");
const projectTabs = fs.readFileSync(path.join(root, "components/projects/workspace/project-tabs.tsx"), "utf8");
const documentsWorkspace = fs.readFileSync(path.join(root, "components/projects/workspace/project-documents-workspace.tsx"), "utf8");
const projectPlaceholder = fs.readFileSync(path.join(root, "components/projects/workspace/project-command-center-tab-placeholder.tsx"), "utf8");
const toolRouter = fs.readFileSync(path.join(root, "lib/orion/intelligence/orion-tool-router.ts"), "utf8");

assert.match(workspaceNavigation, /data-orion-action={`workspace-tab-\$\{tab\.key\}`}/);
assert.match(workspaceNavigation, /data-orion-role={`workspace tab: \$\{tab\.label\}`}/);
assert.match(projectTabs, /RECEIPTS_TAB_KEY = "receipts"/);
assert.match(projectTabs, /PROJECT_WORKSPACE_TABS\.flatMap/);
assert.match(projectTabs, /data-orion-action={`workspace-tab-\$\{item\.key\}`}/);
assert.match(projectTabs, /items\.map\(\(item\)/);
assert.match(projectTabs, /flex min-w-0 items-center gap-1\.5 overflow-x-auto/);
assert.doesNotMatch(projectTabs, /workspace-tab-more/);
assert.doesNotMatch(projectTabs, /data-project-more-menu/);
assert.match(projectTabs, /key: RECEIPTS_TAB_KEY, label: "Receipts"/);
assert.match(projectTabs, /nextParams\.set\("tab", "documents"\)/);
assert.match(projectTabs, /nextParams\.set\("section", RECEIPTS_TAB_KEY\)/);
assert.match(toolRouter, /request to open, show, or select a project workspace tab such as Photos, Documents, Blueprints/i);
assert.match(toolRouter, /use the Orion UI Operator to observe the current screen and click the exact returned workspace-tab semantic action/i);
assert.match(toolRouter, /action:workspace-tab-<tab_key>/i);
assert.match(documentsWorkspace, /searchParams\.get\("section"\) === "receipts"/);
assert.match(documentsWorkspace, /<ProjectReceiptsWorkspace projectId=\{projectId\} \/>/);
assert.doesNotMatch(documentsWorkspace, /role="tablist"/);
assert.match(projectPlaceholder, /linkedTab === "documents"/);
assert.match(projectPlaceholder, /<ProjectDocumentsWorkspace projectId=\{projectId\} localeTag=\{localeTag\} \/>/);

console.log("Orion project tab navigation contract passed.");

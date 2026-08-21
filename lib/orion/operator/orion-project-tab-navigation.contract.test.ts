import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspaceNavigation = fs.readFileSync(path.join(root, "components/workspace/workspace-navigation.tsx"), "utf8");
const projectTabs = fs.readFileSync(path.join(root, "components/projects/workspace/project-tabs.tsx"), "utf8");

assert.match(workspaceNavigation, /data-orion-action={`workspace-tab-\$\{tab\.key\}`}/);
assert.match(workspaceNavigation, /data-orion-role={`workspace tab: \$\{tab\.label\}`}/);
assert.match(projectTabs, /key: tab\.key/);
assert.match(projectTabs, /label: t\(tab\.labelKey\)/);

console.log("Orion project tab navigation contract passed.");

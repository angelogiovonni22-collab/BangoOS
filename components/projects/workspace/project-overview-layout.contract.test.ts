import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
const page = read("app/(app)/projects/[id]/page.tsx");
const overview = read("components/projects/workspace/project-command-center-foundation.tsx");
const header = read("components/projects/workspace/project-workspace-header.tsx");

assert.ok(!page.includes("<ProjectWorkspaceHero"), "the oversized photo/weather hero stays out of the project landing view");
assert.ok(!page.includes("<ProjectKpiGrid"), "the duplicate KPI strip stays out of the project landing view");
assert.ok(overview.includes('data-project-overview="scope-first"'), "the overview declares its scope-first hierarchy");
assert.ok(overview.indexOf("Scope of Work") < overview.indexOf("Jobsite Intelligence"), "scope appears before jobsite weather and maps");
assert.ok(overview.includes("Today's Priorities"));
assert.ok(overview.includes("Project Health"));
assert.ok(overview.includes("Next 7 Days"));
assert.ok(overview.includes("<Collapsible title=\"Jobsite Intelligence\""), "jobsite intelligence is collapsed by default");
assert.ok(overview.includes("<LocationForecastCard"), "live weather and directions remain available");
assert.ok(header.includes("<WorkspaceHeader\n      compact"), "the project header uses the compact layout");

console.log("+ project overview is compact, scope-first, live-data driven, and keeps jobsite intelligence secondary");

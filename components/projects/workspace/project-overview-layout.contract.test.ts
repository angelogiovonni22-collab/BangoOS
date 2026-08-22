import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
const page = read("app/(app)/projects/[id]/page.tsx");
const overview = read("components/projects/workspace/project-command-center-foundation.tsx");
const header = read("components/projects/workspace/project-workspace-header.tsx");

assert.ok(!page.includes("<ProjectWorkspaceHero"), "the oversized photo/weather hero stays out of the project landing view");
assert.ok(!page.includes("<ProjectKpiGrid"), "the duplicate KPI strip stays out of the project landing view");
assert.ok(overview.includes('data-project-overview="jobsite-first-clean"'), "the overview declares its cleaned jobsite-first hierarchy");
assert.ok(overview.indexOf("Jobsite Weather & Map") < overview.indexOf("Scope of Work"), "weather and map appear near the top before the detailed scope");
assert.ok(overview.includes('data-project-jobsite-intelligence="primary"'), "jobsite intelligence is a primary visible section");
assert.ok(overview.includes("Today's Priorities"));
assert.ok(overview.includes("Project Health"));
assert.ok(overview.includes("Next 7 Days"));
assert.ok(!overview.includes("<Collapsible title=\"Jobsite Intelligence\""), "jobsite intelligence is no longer hidden in a bottom accordion");
assert.ok(overview.includes("<LocationForecastCard"), "live weather, map, and directions remain available");
assert.ok(overview.includes("showMap"), "the project landing view keeps the map visible");
assert.ok(header.includes("<WorkspaceHeader\n      compact"), "the project header uses the compact layout");

console.log("+ project overview is compact, jobsite-first, live-data driven, and keeps weather/maps visible");

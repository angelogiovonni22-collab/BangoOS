import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
const page = read("app/(app)/projects/[id]/page.tsx");
const overview = read("components/projects/workspace/project-command-center-foundation.tsx");
const header = read("components/projects/workspace/project-workspace-header.tsx");
const headerWeather = read("components/projects/workspace/project-header-weather-strip.tsx");

assert.ok(!page.includes("<ProjectWorkspaceHero"), "the oversized photo/weather hero stays out of the project landing view");
assert.ok(!page.includes("<ProjectKpiGrid"), "the duplicate KPI strip stays out of the project landing view");
assert.ok(overview.includes('data-project-overview="header-jobsite-clean"'), "the overview declares its cleaned header-jobsite hierarchy");
assert.ok(overview.includes('className="bos-project-details-primary space-y-4"'), "project details are marked as the primary overview content");
assert.ok(overview.includes('> .bos-project-details-primary {\n          order: -1;'), "project details render ahead of the Project Operating System panel");
assert.ok(overview.includes("Scope of Work"));
assert.ok(overview.includes("Today's Priorities"));
assert.ok(overview.includes("Project Health"));
assert.ok(overview.includes("Next 7 Days"));
assert.ok(!overview.includes('<Info label="Job site"'), "job-site address is not duplicated in Project Team");
assert.ok(!overview.includes("<LocationForecastCard"), "the full-width weather/map card no longer consumes the project overview");
assert.ok(!overview.includes('data-project-jobsite-intelligence="primary"'));
assert.ok(header.includes("<WorkspaceHeader\n        compact"), "the project header uses the compact layout");
assert.ok(header.includes("<ProjectHeaderWeatherStrip />"), "weather and map sit directly with the project header");
assert.ok(header.includes('data-project-header-with-jobsite-intelligence="true"'));
assert.ok(headerWeather.includes('data-project-header-jobsite-intelligence="true"'));
assert.ok(headerWeather.includes("lg:grid-cols-[1.05fr_1fr_0.9fr]"), "desktop jobsite intelligence uses a compact horizontal strip");
assert.ok(headerWeather.includes("min-h-[112px]"), "weather and map stay short instead of stretching vertically");

console.log("+ project overview prioritizes project details and keeps jobsite data in the header");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const customersPage = read("app/(app)/customers/page.tsx");
const kpiGrid = read("components/scheduling/scheduling-kpi-grid.tsx");
const scheduleCalendar = read("components/scheduling/schedule-calendar.tsx");
const scheduleWeek = read("components/scheduling/schedule-week-view.tsx");
const schedulingDashboard = read("components/scheduling/scheduling-dashboard.tsx");
const orionButton = read("components/orion/persistent/PersistentOrionButton.tsx");

assert.match(customersPage, /\.from\("invoices"\)/, "customer directory must calculate revenue from persisted invoices");
assert.doesNotMatch(customersPage, /lifetimeRevenue:\s*"Coming Soon"/, "customer revenue must not be a placeholder");

assert.doesNotMatch(kpiGrid, /t\(item\.trendKey\)/, "live scheduling KPIs must not display canned trend claims");
assert.match(scheduleCalendar, /\[\.\.\.assignments\]\.sort/, "schedule sorting must not mutate the source assignment array");
assert.match(scheduleWeek, /crewNames\.get\(id\)/, "crew grouping must resolve display names instead of exposing raw ids");
assert.match(scheduleWeek, /employeeNames\.get\(id\)/, "employee grouping must resolve display names instead of exposing raw ids");
assert.match(schedulingDashboard, /crewOptions=\{payload\.crewOptions\}/, "live schedule must provide crew display names to the calendar");
assert.match(schedulingDashboard, /employeeOptions=\{payload\.employeeOptions\}/, "live schedule must provide employee display names to the calendar");

assert.match(orionButton, /fixture\.state === "UNAVAILABLE"/, "Orion accessibility copy must recognize unavailable state");
assert.match(orionButton, /Orion is unavailable\./, "Orion screen-reader copy must truthfully announce unavailability");

console.log("Production route audit contract passed.");

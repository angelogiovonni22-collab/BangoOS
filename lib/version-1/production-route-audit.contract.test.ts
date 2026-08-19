import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const customersPage = read("app/(app)/customers/page.tsx");
const projectsPage = read("app/(app)/projects/page.tsx");
const projectFilters = read("components/projects/project-filters.tsx");
const kpiGrid = read("components/scheduling/scheduling-kpi-grid.tsx");
const scheduleCalendar = read("components/scheduling/schedule-calendar.tsx");
const scheduleWeek = read("components/scheduling/schedule-week-view.tsx");
const schedulingDashboard = read("components/scheduling/scheduling-dashboard.tsx");
const crewOperations = read("components/crews/workforce-operations-dashboard.tsx");
const orionButton = read("components/orion/persistent/PersistentOrionButton.tsx");

assert.match(customersPage, /\.from\("invoices"\)/, "customer directory must calculate revenue from persisted invoices");
assert.doesNotMatch(customersPage, /lifetimeRevenue:\s*"Coming Soon"/, "customer revenue must not be a placeholder");

assert.match(projectsPage, /ACTIVE_PROJECT_STATUS_KEYS = new Set\(\["approved", "scheduled", "in_progress"\]\)/, "project active KPI must use the same operating lifecycle as the dashboard");
assert.match(projectsPage, /ACTIVE_PROJECT_STATUS_KEYS\.has\(project\.statusKey\)/, "project active KPI must exclude lead and estimating records");
assert.match(projectFilters, /projects\.filterProjectManager/, "project manager filters must use consistent terminology");
assert.doesNotMatch(projectFilters, />Superintendent</, "project manager filter must not present a conflicting superintendent label");

assert.doesNotMatch(kpiGrid, /t\(item\.trendKey\)/, "live scheduling KPIs must not display canned trend claims");
assert.match(scheduleCalendar, /\[\.\.\.assignments\]\.sort/, "schedule sorting must not mutate the source assignment array");
assert.match(scheduleWeek, /crewNames\.get\(id\)/, "crew grouping must resolve display names instead of exposing raw ids");
assert.match(scheduleWeek, /employeeNames\.get\(id\)/, "employee grouping must resolve display names instead of exposing raw ids");
assert.match(schedulingDashboard, /crewOptions=\{payload\.crewOptions\}/, "live schedule must provide crew display names to the calendar");
assert.match(schedulingDashboard, /employeeOptions=\{payload\.employeeOptions\}/, "live schedule must provide employee display names to the calendar");
assert.match(crewOperations, /crewOptions=\{scheduling\.payload\.crewOptions\}/, "CrewOS calendar must provide crew names instead of exposing raw ids");
assert.doesNotMatch(crewOperations, /Future integration interfaces for GPS, Time Clock, and Orion remain provider-based and are not implemented in this phase\./, "CrewOS must not expose a stale implementation disclaimer");

assert.match(orionButton, /fixture\.state === "UNAVAILABLE"/, "Orion accessibility copy must recognize unavailable state");
assert.match(orionButton, /Orion is unavailable\./, "Orion screen-reader copy must truthfully announce unavailability");

console.log("Production route audit contract passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const customersPage = read("app/(app)/customers/page.tsx");
const customerTable = read("components/customers/customer-table.tsx");
const estimateDetail = read("components/estimates/estimate-detail.tsx");
const projectsPage = read("app/(app)/projects/page.tsx");
const projectFilters = read("components/projects/project-filters.tsx");
const kpiGrid = read("components/scheduling/scheduling-kpi-grid.tsx");
const scheduleCalendar = read("components/scheduling/schedule-calendar.tsx");
const scheduleWeek = read("components/scheduling/schedule-week-view.tsx");
const schedulingDashboard = read("components/scheduling/scheduling-dashboard.tsx");
const crewOperations = read("components/crews/workforce-operations-dashboard.tsx");
const orionButton = read("components/orion/persistent/PersistentOrionButton.tsx");
const orionPanel = read("components/orion/persistent/PersistentOrionPanel.tsx");

assert.match(customersPage, /\.from\("invoices"\)/, "customer directory must calculate revenue from persisted invoices");
assert.doesNotMatch(customersPage, /lifetimeRevenue:\s*"Coming Soon"/, "customer revenue must not be a placeholder");
assert.doesNotMatch(customerTable, /\?edit=1/, "customer edit actions must not route to a no-op query-string view");
assert.match(customerTable, /\/customers\/\$\{customer\.id\}\/edit/, "customer row edit action must open the real edit route");
assert.match(customerTable, /\/customers\/\$\{openMenu\.customer\.id\}\/edit/, "customer action menu must open the real edit route");

assert.doesNotMatch(estimateDetail, /future sprint/i, "estimate detail must not expose future-sprint placeholder copy in production");
assert.doesNotMatch(estimateDetail, /Status history and estimate activity timeline will be expanded/, "estimate detail must not present an unimplemented activity section as production content");

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

assert.match(orionButton, /normalizedVoicePhase/, "Orion accessible state must be derived from the live voice lifecycle");
assert.match(orionButton, /normalizedVoicePhase === "idle"/, "idle Orion must announce a neutral ready state");
assert.doesNotMatch(orionButton, /fixture\.state === "UNAVAILABLE"/, "route fixtures must not make Orion announce false unavailability");
assert.doesNotMatch(orionButton, /Orion is unavailable\./, "persistent Orion must not announce route-fixture unavailability when the control is available");
assert.match(orionPanel, /formatVoicePhase\(voice\.phase\)/, "persistent Orion panel state must come from the live voice lifecycle");
assert.doesNotMatch(orionPanel, /fixture\.observation/, "production Orion panel must not present deterministic route observations as live intelligence");
assert.doesNotMatch(orionPanel, /fixture\.whyItMatters/, "production Orion panel must not present deterministic route impact claims as live intelligence");
assert.doesNotMatch(orionPanel, /fixture\.evidenceStatus|fixture\.dataFreshness|fixture\.recommendedNextReview|fixture\.approvalBoundary|fixture\.limitations/, "production Orion panel must not present fixture evidence metadata as live operational facts");

console.log("Production route audit contract passed.");

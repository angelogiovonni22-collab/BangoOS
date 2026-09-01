import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/(app)/projects/page.tsx", "utf8");
const filters = readFileSync("components/projects/project-filters.tsx", "utf8");
const table = readFileSync("components/projects/project-table.tsx", "utf8");
const kpi = readFileSync("components/projects/projects-page-kpi.tsx", "utf8");

assert.match(page, /ProjectsPageKpi/, "Projects KPI cards must use the interactive KPI component");
assert.match(page, /summaryView/, "Projects KPI cards must filter the directory");
assert.match(kpi, /aria-pressed/, "Projects KPI cards must expose selected state");
assert.match(kpi, /onClick/, "Projects KPI cards must be clickable");
assert.match(filters, /xl:grid-cols-6/, "Projects filters must fit one desktop row");
assert.match(filters, /xl:col-span-2/, "Projects search should use two columns in the desktop filter row");
assert.doesNotMatch(table, /disabled>Projects/, "Active Projects lifecycle tab must not use disabled-button styling");
assert.match(table, /aria-current="page"/, "Active Projects lifecycle tab must expose current-page semantics");
assert.match(table, /text-white/, "Active Projects lifecycle tab must have readable high-contrast text");
assert.match(table, /min-w-\[920px\]/, "Projects table should avoid unnecessary horizontal overflow");
assert.doesNotMatch(table, /projects\.tableCustomer/, "Customer must not be duplicated into a separate desktop column");
assert.doesNotMatch(table, />Margin</, "Projects directory must not present an ungrounded profit-margin column");
assert.match(table, />Payments</, "Invoice payment data must be labeled accurately in the Projects directory");
assert.match(page, /spent <= 0\) return "Not available"/, "Projects must not show a misleading 100% margin with no recorded financial activity");

console.log("Projects page polish contract passed.");

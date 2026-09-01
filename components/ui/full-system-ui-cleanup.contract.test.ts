import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const summaryCard = readFileSync("components/ui/summary-card.tsx", "utf8");
const dailyReports = readFileSync("app/(app)/daily-reports/page.tsx", "utf8");
const dailyReportData = readFileSync("lib/daily-reports/daily-reports-page-data.ts", "utf8");
const projectTabs = readFileSync("components/projects/workspace/project-tabs.tsx", "utf8");
const takeoffs = readFileSync("components/plans/blueprint-takeoff-register.tsx", "utf8");
const plansTable = readFileSync("components/plans/plans-table.tsx", "utf8");
const plansPreview = readFileSync("components/plans/plans-preview.tsx", "utf8");
const timeline = readFileSync("app/(app)/timeline/page.tsx", "utf8");
const deletedProjects = readFileSync("app/(app)/projects/deleted/page.tsx", "utf8");
const estimates = readFileSync("components/estimates/estimates-directory.tsx", "utf8");
const invoices = readFileSync("components/invoices/invoices-directory.tsx", "utf8");

assert.match(summaryCard, /onClick\?: \(\) => void/, "SummaryCard must support useful interaction");
assert.match(summaryCard, /aria-pressed/, "Interactive summary cards must expose selected state");
assert.match(dailyReports, /Pending Review/, "Daily Reports should use the actual submitted/review queue language");
assert.match(dailyReports, /Reviewed/, "Daily Reports should show the supported reviewed status");
assert.doesNotMatch(dailyReports, /Rejected/, "Daily Reports must not expose an unsupported rejected status");
assert.match(dailyReportData, /reviewed:/, "Daily Reports data must count reviewed reports");
assert.doesNotMatch(dailyReportData, /rejected:/, "Daily Reports data must not hard-code a rejected metric");
assert.match(projectTabs, /min-h-10/, "Project workspace tabs must retain readable touch targets");
assert.match(projectTabs, /text-sm/, "Project workspace tab labels must be readable");
assert.doesNotMatch(takeoffs, /bg-emerald-50|text-slate-950|text-slate-800/, "Blueprint takeoff cards must use semantic BOS theme tokens");
assert.match(plansTable, /self-start/, "Blueprint document register must not stretch to the folder sidebar height");
assert.match(plansPreview, /self-start/, "Blueprint preview must not stretch to the folder sidebar height");
assert.doesNotMatch(plansPreview, /bg-white/, "Blueprint preview must use semantic surface tokens");
assert.match(timeline, /PageHeader/, "Timeline must use the shared BOS page header");
assert.match(timeline, /bg-\[var\(--color-surface-card\)\]/, "Timeline surfaces must use BOS semantic colors");
assert.doesNotMatch(deletedProjects, /disabled>Previously Deleted/, "Deleted Projects active tab must not use disabled-button styling");
assert.match(deletedProjects, /aria-current="page"/, "Deleted Projects active tab must expose current-page semantics");
assert.match(estimates, /Estimate summary filters/, "Estimate KPIs must operate as directory filters");
assert.match(estimates, /onClick=\{\(\) => chooseStatus/, "Estimate status KPIs must be clickable");
assert.match(invoices, /Invoice summary filters/, "Invoice KPIs must operate as directory filters");
assert.match(invoices, /chooseOutstanding/, "Outstanding invoice KPI must filter by balance due");

console.log("Full-system UI cleanup contract passed.");

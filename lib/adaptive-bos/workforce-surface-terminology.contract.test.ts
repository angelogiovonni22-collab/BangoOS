import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workforcePage = readFileSync("app/(app)/employees/page.tsx", "utf8");
const workforceFilters = readFileSync("components/employees/employee-filters.tsx", "utf8");
const workforceTable = readFileSync("components/employees/employee-table.tsx", "utf8");
const workforceMetrics = readFileSync("components/employees/employee-dashboard-metrics.tsx", "utf8");

assert.match(workforcePage, /useAdaptiveBos/, "Workforce workspace must resolve Adaptive B.O.S. terminology");
assert.match(workforcePage, /term\("workforce", "Workforce"\)/, "Workforce workspace must resolve its industry-specific label");
assert.match(workforcePage, /term\("project", "Project"\)/, "Workforce workspace must resolve project terminology");
assert.match(workforcePage, /title=\{workforceLabel\}/, "Workforce page title must use adaptive terminology");
assert.match(workforcePage, /New Team Member/, "Workforce primary action must use cross-industry member terminology");
assert.doesNotMatch(workforcePage, /title=\{t\("employees\.pageTitle"\)\}/, "Workforce page must not use a fixed employee title");

assert.match(workforceFilters, /projectLabel: string/, "Workforce filters must receive adaptive project terminology");
assert.match(workforceFilters, /All \{projectsLabel\}/, "Workforce project filter must use adaptive plural project terminology");
assert.match(workforceFilters, /Search team members/, "Workforce search must use cross-industry member terminology");
assert.doesNotMatch(workforceFilters, /aria-label="Project filter"/, "Workforce project filter must not hard-code Project");

assert.match(workforceTable, /projectLabel: string/, "Workforce table must receive adaptive project terminology");
assert.match(workforceTable, /<TableHeading>Team Member<\/TableHeading>/, "Workforce table must use cross-industry member terminology");
assert.match(workforceTable, /<TableHeading>\{projectLabel\}<\/TableHeading>/, "Workforce table must use adaptive project terminology");

assert.match(workforceMetrics, /workforceLabel: string/, "Workforce KPIs must receive adaptive workforce terminology");
assert.match(workforceMetrics, /aria-label=\{`\$\{workforceLabel\} summary`\}/, "Workforce KPI group must expose adaptive terminology");
assert.match(workforceMetrics, /Assigned to \$\{projectLabel\}/, "Workforce assignment KPI must use adaptive project terminology");
assert.doesNotMatch(workforceMetrics, /actionLabel="Show all employees"/, "Workforce KPI actions must not hard-code employee terminology");

console.log("Adaptive B.O.S. workforce surface terminology contract passed.");

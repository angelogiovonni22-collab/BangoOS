import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/(app)/projects/[id]/page.tsx", "utf8");
const tabs = readFileSync("components/projects/workspace/project-workspace-tabs.ts", "utf8");
const tabUi = readFileSync("components/projects/workspace/project-tabs.tsx", "utf8");
const scope = readFileSync("components/projects/workspace/project-scope-of-work.tsx", "utf8");
const types = readFileSync("components/projects/workspace/types.ts", "utf8");
const en = readFileSync("locales/en/projects.json", "utf8");
const es = readFileSync("locales/es/projects.json", "utf8");
const projectScopeMigration = readFileSync("supabase/migrations/20260926033200_project_scope_line_items.sql", "utf8");

test("Scope of Work is a first-class project workspace tab", () => {
  assert.match(types, /\| "scope"/);
  assert.match(tabs, /key: "scope"/);
  assert.match(tabUi, /scope: <FileSpreadsheet/);
  assert.match(page, /activeTab === "scope"/);
  assert.match(page, /<ProjectScopeOfWork/);
  assert.match(page, /estimateId=\{workspace\.originalEstimateId\}/);
  assert.match(en, /"workspaceTabScope": "Scope of Work"/);
  assert.match(es, /"workspaceTabScope": "Alcance del trabajo"/);
});

test("Scope of Work preserves the approved B.O.S. mockup structure", () => {
  for (const label of [
    "Scope Value",
    "Material Budget",
    "Labor Budget",
    "Total Estimated Cost",
    "Gross Margin",
    "Scope Categories",
    "View Original Estimate",
    "Export Scope",
    "Scope of Work Summary",
    "Itemized Scope & Cost Breakdown",
    "Trade / Scope Summary",
    "Notes / Inclusions / Exclusions",
    "Materials Cost",
    "Labor Cost",
    "Total Cost",
  ]) {
    assert.ok(scope.includes(label), "missing approved mockup label: " + label);
  }
  assert.match(scope, /CATEGORY_COLORS/);
});

test("Scope of Work is grounded in live estimate and editable project scope data", () => {
  assert.match(scope, /\.from\("estimates"\)/);
  assert.match(scope, /\.from\("estimate_line_items"\)/);
  assert.match(scope, /\.from\("project_scope_items"\)/);
  assert.match(scope, /internal_cost_total/);
  assert.match(scope, /gross_profit/);
  assert.match(scope, /gross_margin_percent/);
  assert.match(scope, /scope_inclusions/);
  assert.match(scope, /scope_exclusions/);
});

console.log("Project Scope of Work contract passed.");


test("Scope of Work renders the exact ten-category trade breakdown instead of bundled material/labor rows", () => {
  for (const category of [
    "Demo",
    "Framing",
    "Plumbing",
    "Electrical",
    "Drywall",
    "Painting",
    "Flooring",
    "Trim",
    "Windows",
    "Appliances / Fixtures",
  ]) {
    assert.ok(scope.includes(`name: "${category}"`), "missing trade category: " + category);
  }
  assert.doesNotMatch(scope, /return "Materials"/);
  assert.doesNotMatch(scope, /return "Labor"/);
  assert.match(scope, /Material and labor costs are managed directly in the scope rows above/);
});

test("Scope of Work does not duplicate the itemized breakdown with a separate Materials Detail card", () => {
  assert.doesNotMatch(scope, /title="Materials Detail"/);
  assert.doesNotMatch(scope, /Individual material prices are not separately itemized/);
  assert.doesNotMatch(scope, /project_material_plan_items/);
  assert.match(scope, /Trade \/ Scope Summary/);
  assert.match(scope, /Itemized Scope & Cost Breakdown/);
});


test("working scope line items are editable without mutating the accepted estimate", () => {
  assert.match(projectScopeMigration, /create table if not exists public\.project_scope_items/i);
  assert.match(projectScopeMigration, /Editable project working scope breakdown/i);
  assert.match(projectScopeMigration, /enable row level security/i);
  assert.match(projectScopeMigration, /project_scope_items_insert/i);
  assert.match(projectScopeMigration, /project_scope_items_update/i);
  assert.match(projectScopeMigration, /project_scope_items_delete/i);

  assert.match(scope, /\.from\("project_scope_items"\)/);
  assert.match(scope, /Add Category/);
  assert.match(scope, /Edit Line Item/);
  assert.match(scope, /Remove this scope line item from the project working scope/);
  assert.match(scope, /The accepted estimate will not be changed/);
  assert.match(scope, /Save Line Item/);
  assert.match(scope, /materializeScopeItems/);
  assert.match(scope, /\.insert\(payload\)/);
  assert.match(scope, /\.update\(\{/);
  assert.match(scope, /\.delete\(\)/);
});

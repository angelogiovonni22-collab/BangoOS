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

test("Scope of Work presents a consolidated financial and scope hierarchy", () => {
  for (const label of [
    "Original Contract",
    "Approved Change Orders",
    "Current Contract",
    "Projected Cost",
    "Projected Gross Profit",
    "Working Scope",
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
    assert.ok(scope.includes(label), "missing scope hierarchy label: " + label);
  }
  assert.match(scope, /data-scope-financial-snapshot/);
  assert.match(scope, /data-scope-actions/);
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
  assert.match(scope, /Material and labor costs are managed directly in the editable base scope above/);
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


test("approved change orders become highlighted live scope without mutating the estimate", () => {
  assert.match(scope, /\.from\("change_orders"\)/);
  assert.match(scope, /\.eq\("project_id", projectId\)/);
  assert.match(scope, /\.in\("status", \["approved", "invoiced"\]\)/);
  assert.match(scope, /\.is\("archived_at", null\)/);
  assert.match(scope, /change_order_line_items\(id,sort_order,description,cost_amount,price_amount,notes\)/);
  assert.match(scope, /Approved Change Orders/);
  assert.match(scope, /Current Contract/);
  assert.match(scope, /data-approved-change-orders-section/);
  assert.match(scope, /Customer Price/);
  assert.match(scope, /Internal Cost/);
  assert.match(scope, /Margin Impact/);
  assert.match(scope, /\/change-orders\/\$\{changeOrder\.id\}/);
  assert.match(scope, /approvedChangeOrderCost/);
  assert.match(scope, /roll into Projected Cost without changing the accepted estimate baseline/);
});


test("scope preserves the accepted estimate while projected margin follows live working scope", () => {
  assert.match(scope, /acceptedMaterialBudget/);
  assert.match(scope, /acceptedLaborBudget/);
  assert.match(scope, /liveScopeBaseCost = scopeMaterialized \? workingCost : estimatedCost/);
  assert.match(scope, /currentEstimatedCost = liveScopeBaseCost \+ approvedChangeOrderCost/);
  assert.match(scope, /currentGrossMargin = currentContractValue - currentEstimatedCost/);
  assert.match(scope, /Working Scope/);
  assert.match(scope, /Accepted Estimate Baseline/);
  assert.match(scope, /Scope Reconciliation/);
  assert.match(scope, /Projected cost and margin follow the live working scope plus approved change-order cost/);
  assert.match(scope, /router\.refresh\(\)/);
  assert.match(scope, /quantity \|\| 0\) \* Number\(line\.unit_cost \|\| 0\)/);
  assert.match(scope, /materialResidual/);
  assert.match(scope, /laborResidual/);
});

test("scope explains zero-value approved change-order margin impact without duplicate warning banners", () => {
  assert.match(scope, /data-scope-reconciliation/);
  assert.match(scope, /Working Scope Variance/);
  assert.match(scope, /customer price/);
  assert.match(scope, /internal cost/);
  assert.match(scope, /Change Order Margin Impact/);
  assert.match(scope, /approvedChangeOrderCost > 0 && approvedChangeOrderValue <= 0/);
  assert.doesNotMatch(scope, /data-unpriced-change-order-warning/);
});


test("scope line-item editor uses the mobile viewport without dead space", () => {
  assert.match(scope, /h-[100dvh]/, "mobile line-item editor must use the full dynamic viewport height");
  assert.match(scope, /sm:h-auto/, "desktop line-item editor must remain a centered content-height dialog");
  assert.match(scope, /overflow-y-auto/, "mobile editor content must scroll inside the sheet");
  assert.match(scope, /flex-1 content-start/, "form fields must start at the top of the available mobile sheet");
  assert.match(scope, /shrink-0 justify-end/, "editor actions must stay attached to the bottom of the sheet");
});

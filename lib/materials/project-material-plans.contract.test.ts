import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/20260826235839_project_material_plans_phase_1.sql"), "utf8");
const planService = readFileSync(join(root, "lib/materials/project-material-plan-service.ts"), "utf8");
const procurementService = readFileSync(join(root, "lib/materials/procurement-service.ts"), "utf8");
const workspace = readFileSync(join(root, "app/(app)/projects/[id]/materials/project-material-plan-client.tsx"), "utf8");

assert.match(migration, /create table if not exists public\.project_material_plan_items/i, "Approved estimate materials need a project planning table.");
assert.match(migration, /original_unit_cost/i, "The approved estimate cost snapshot must remain available for variance reporting.");
assert.match(migration, /inventory_quantity <= estimated_quantity/i, "Inventory allocation cannot exceed the approved material requirement.");
assert.match(migration, /bootstrap_project_material_plan/i, "Completed estimate conversion must bootstrap the project material plan.");
assert.match(migration, /item\.category = 'materials'/i, "Only estimate material lines may enter the material plan.");
assert.match(migration, /on conflict \(project_id, estimate_line_item_id\)[\s\S]*do nothing/i, "Material-plan bootstrapping must be idempotent.");
assert.match(migration, /enable row level security/i, "Project material plans must be protected by RLS.");
assert.match(migration, /project_material_plan_item_id/i, "Purchase-order lines must retain their project-plan origin.");

assert.match(planService, /createDraftPurchaseOrder/i, "The project material plan must reuse the controlled procurement service.");
assert.match(planService, /projectMaterialPlanItemId: item\.id/i, "Draft PO lines must link back to their material-plan item.");
assert.match(planService, /Drafted from the project material plan/i, "Draft POs must state their review boundary.");
assert.doesNotMatch(planService, /approvePurchaseOrder|issuePurchaseOrder/, "The project plan must never approve or issue a purchase order automatically.");
assert.match(procurementService, /project_material_plan_item_id: line\.projectMaterialPlanItemId \|\| null/i, "Procurement must persist the material-plan link.");

assert.match(workspace, /Create draft PO/i, "The project UI must describe the purchasing action as draft-only.");
assert.match(workspace, /authorized employee must still review/i, "The UI must make final approval controls explicit.");
assert.match(workspace, /Estimate snapshot/i, "Users must see the approved cost baseline.");
assert.match(workspace, /Current purchase cost/i, "Users must see current purchasing cost separately.");

console.log("Project material plan contract passed.");

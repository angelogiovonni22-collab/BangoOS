import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const service = readFileSync(join(root, "lib/financial-reporting/ap-aware-service.ts"), "utf8");
const types = readFileSync(join(root, "lib/financial-reporting/types.ts"), "utf8");
const index = readFileSync(join(root, "lib/financial-reporting/index.ts"), "utf8");

assert.match(service, /ACTUAL_BILL_STATUSES[\s\S]*approved[\s\S]*partially_paid[\s\S]*paid/, "Only financially approved AP lifecycle states may become actual job cost.");
assert.match(service, /\.from\("vendor_bills"\)/, "Project job costing must load project-scoped vendor bills.");
assert.match(service, /\.from\("vendor_bill_line_items"\)/, "Project job costing must classify AP line items.");
assert.match(service, /if \(line\.purchase_order_line_item_id\) continue;/, "PO-linked AP lines must not double-count procurement/inventory actual cost.");
assert.match(service, /actualCost = money\(base\.summary\.actualCost \+ incrementalActual\)/, "Approved non-PO AP cost must increase canonical actual cost.");
assert.match(service, /forecastFinalCost = money\(Math\.max\(actualCost \+ base\.summary\.committedCost, base\.summary\.revisedBudget\)\)/, "Forecast at completion must react to actual plus committed cost.");
assert.match(service, /grossProfit = money\(base\.summary\.revisedContractValue - forecastFinalCost\)/, "Forecast gross profit must use revised contract value minus forecast final cost.");
assert.match(service, /matchedBillCount/, "Job costing must expose AP reconciliation readiness.");
assert.match(service, /needsReviewBillCount/, "Job costing must expose unresolved AP reconciliation risk.");
assert.match(service, /subcontractor[\s\S]*vendors/, "Subcontractor bills must roll into vendor job cost.");
assert.match(service, /equipment[\s\S]*rental[\s\S]*equipment/, "Equipment and rental bills must roll into equipment job cost.");
assert.match(types, /AccountsPayableJobCostSnapshot/, "Financial report types must expose AP job-cost intelligence.");
assert.match(types, /vendor_bills/, "Financial metric provenance must identify vendor bills.");
assert.match(types, /vendor_bill_line_items/, "Financial metric provenance must identify vendor bill lines.");
assert.match(index, /ap-aware-service/, "AP-aware project reporting must be the canonical exported financial report.");

console.log("Job Costing & Financial Intelligence contract passed.");

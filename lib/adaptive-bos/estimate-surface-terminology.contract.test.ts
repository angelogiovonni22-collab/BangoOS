import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "app/(app)/estimates/page.tsx"), "utf8");
const directory = fs.readFileSync(path.join(root, "components/estimates/estimates-directory.tsx"), "utf8");
const filters = fs.readFileSync(path.join(root, "components/estimates/estimates-filters.tsx"), "utf8");
const emptyState = fs.readFileSync(path.join(root, "components/estimates/estimate-empty-state.tsx"), "utf8");

for (const [label, source] of Object.entries({ page, directory, filters, emptyState })) {
  assert(source.includes("useAdaptiveBos"), `${label} must consume Adaptive B.O.S. terminology`);
}
assert(page.includes('term("estimate", "Estimate")'));
assert(page.includes('term("estimates", "Estimates")'));
assert(directory.includes('term("customers", "Customers")'));
assert(directory.includes('term("projects", "Projects")'));
assert(filters.includes('term("customer", "Customer")'));
assert(filters.includes('term("project", "Project")'));
assert(!page.includes("construction estimates"), "Estimate workspace copy must not stay construction-specific");

console.log("Adaptive B.O.S. estimate surface terminology contract passed");

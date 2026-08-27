import assert from "node:assert/strict";
import { compareSupplierPrices, effectiveSupplierUnitCost } from "./supplier-price-comparison";

assert.equal(effectiveSupplierUnitCost(12, null), 12);
assert.equal(effectiveSupplierUnitCost(12, 9.5), 9.5);

const comparison = compareSupplierPrices([
  { entryId: "a", vendorId: "v1", vendorName: "Supplier A", supplierSku: "A-1", description: "Stud", unitOfMeasure: "each", effectiveUnitCost: 4.25, listName: "A", branchName: null, effectiveOn: "2026-08-01", verifiedOn: "2026-08-20", availability: "In Stock" },
  { entryId: "b", vendorId: "v2", vendorName: "Supplier B", supplierSku: "B-1", description: "Stud", unitOfMeasure: "each", effectiveUnitCost: 3.75, listName: "B", branchName: null, effectiveOn: "2026-08-01", verifiedOn: "2026-08-25", availability: "In Stock" },
], "a");
assert.equal(comparison.best?.entryId, "b");
assert.equal(comparison.selected?.entryId, "a");
assert.equal(comparison.potentialSavings, 0.5);
console.log("supplier price comparison contract: ok");

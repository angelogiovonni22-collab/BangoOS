import assert from "node:assert/strict";
import { buildEstimateToOrderPlan } from "./estimate-to-order-automation";
import type { ProjectMaterialPlanItem } from "./project-material-plan-types";
import type { SupplierPriceComparison } from "./supplier-price-comparison";

const item = { id:"i1", projectId:"p", estimateId:"e", materialId:"m", description:"2x4 stud", itemCode:"SKU", unitOfMeasure:"each", estimatedQuantity:10, inventoryAvailable:0, inventoryQuantity:0, quantityToPurchase:10, quantityOrdered:0, quantityReceived:0, quantityRemaining:10, originalUnitCost:4, currentUnitCost:4, estimatedPurchaseCost:40, currentPurchaseCost:40, costVariance:0, selectedVendorId:null, selectedVendorName:null, requiredOn:null, status:"ready_to_order", orderStatus:"not_ordered" } as ProjectMaterialPlanItem;
const option = { entryId:"price", vendorId:"v1", vendorName:"Supplier", listName:"Current", branchName:null, supplierSku:"SKU", description:"2x4 stud", effectiveUnitCost:3.5, listUnitPrice:4, contractorUnitPrice:3.5, unitOfMeasure:"each", availability:"In Stock", effectiveOn:"2026-08-27", verifiedOn:"2026-08-27" };
const comparison = { planItemId:"i1", options:[option], best:option, selected:null } as SupplierPriceComparison;
const result = buildEstimateToOrderPlan([item], { i1: comparison });
assert.equal(result.totals.readyLines, 1);
assert.equal(result.totals.blockedLines, 0);
assert.equal(result.totals.plannedCost, 35);
assert.equal(result.totals.savingsAgainstCurrent, 5);
assert.equal(result.groups[0]?.vendorId, "v1");
assert.deepEqual(result.groups[0]?.lineIds, ["i1"]);
console.log("estimate-to-order automation contract: ok");

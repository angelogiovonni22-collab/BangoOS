import assert from "node:assert/strict";
import { buildPurchasingExecutionPlan } from "./purchasing-execution";
import type { EstimateToOrderPlan } from "./estimate-to-order-automation";
import type { ProjectMaterialPlanItem } from "./project-material-plan-types";

const material = { id:"i1", projectId:"p1", estimateId:"e1", materialId:"m1", description:"2x4 stud", itemCode:"SKU", unitOfMeasure:"each", estimatedQuantity:10, inventoryAvailable:0, inventoryQuantity:0, quantityToPurchase:10, quantityOrdered:0, quantityReceived:0, quantityRemaining:10, originalUnitCost:4, currentUnitCost:4, estimatedPurchaseCost:40, currentPurchaseCost:40, costVariance:0, selectedVendorId:"v1", selectedVendorName:"Supplier", requiredOn:null, status:"ready_to_order", orderStatus:"not_ordered" } as ProjectMaterialPlanItem;
const plan: EstimateToOrderPlan = {
  lines:[{ itemId:"i1", description:"2x4 stud", quantity:10, vendorId:"v1", vendorName:"Supplier", supplierPriceEntryId:"price", unitCost:3.5, extendedCost:35, savingsAgainstCurrent:5, readiness:"ready" }],
  groups:[{ vendorId:"v1", vendorName:"Supplier", lineIds:["i1"], subtotal:35 }],
  totals:{ remainingUnits:10, plannedCost:35, savingsAgainstCurrent:5, readyLines:1, blockedLines:0 },
};
const execution = buildPurchasingExecutionPlan("p1", plan, [material]);
assert.equal(execution.readyToPrepare, true);
assert.equal(execution.requiresApproval, true);
assert.equal(execution.supplierSubmissionAllowed, false);
assert.equal(execution.drafts.length, 1);
assert.equal(execution.drafts[0]?.input.lines[0]?.projectMaterialPlanItemId, "i1");
assert.equal(execution.drafts[0]?.input.lines[0]?.quantityOrdered, 10);
assert.equal(execution.drafts[0]?.input.lines[0]?.unitCost, 3.5);

const blockedPlan: EstimateToOrderPlan = { lines:[{ ...plan.lines[0]!, vendorId:null, vendorName:null, supplierPriceEntryId:null, readiness:"needs_supplier_price" }], groups:[], totals:{ ...plan.totals, readyLines:0, blockedLines:1 } };
const blocked = buildPurchasingExecutionPlan("p1", blockedPlan, [material]);
assert.equal(blocked.readyToPrepare, false);
assert.equal(blocked.drafts.length, 0);
assert.deepEqual(blocked.blockedItemIds, ["i1"]);
assert.equal(blocked.supplierSubmissionAllowed, false);
console.log("purchasing execution contract: ok");

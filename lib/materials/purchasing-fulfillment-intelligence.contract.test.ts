import assert from "node:assert/strict";
import { summarizePurchaseOrderFulfillment } from "./purchasing-fulfillment-intelligence";
import type { ProcurementPurchaseOrder, ProcurementPurchaseOrderLine } from "./procurement-types";

const order: ProcurementPurchaseOrder = { id:"po", poNumber:"PO-1", vendorId:"v", vendorName:"Supplier", projectId:"p", projectName:"Project", costCodeId:null, costCodeLabel:null, status:"partially_received", subtotalAmount:100, taxAmount:0, shippingAmount:10, totalAmount:110, issuedAt:"2026-08-27", createdAt:"2026-08-27", notes:null };
const lines: ProcurementPurchaseOrderLine[] = [{ id:"l", purchaseOrderId:"po", materialId:"m", materialName:"Stud", description:"Stud", quantityOrdered:10, quantityReceived:6, quantityDamaged:1, quantityBackordered:3, unitCost:10, lineSubtotal:100, projectId:"p", costCodeId:null, projectMaterialPlanItemId:null }];
const result = summarizePurchaseOrderFulfillment(order, lines);
assert.equal(result.stage, "partially_received");
assert.equal(result.remainingQuantity, 3);
assert.equal(result.receivedPercent, 60);
assert.equal(result.receivedCost, 60);
assert.equal(result.risk, "critical");
assert.match(result.riskReason ?? "", /damaged/);
console.log("purchasing fulfillment intelligence contract: ok");

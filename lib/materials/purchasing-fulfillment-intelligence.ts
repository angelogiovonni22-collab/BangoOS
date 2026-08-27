import type { ProcurementOverviewPayload, ProcurementPurchaseOrder, ProcurementPurchaseOrderLine } from "./procurement-types";

export type FulfillmentStage = "needed" | "priced" | "ready_to_order" | "ordered" | "partially_received" | "received" | "cancelled";

export type PurchaseOrderFulfillment = {
  purchaseOrderId: string;
  stage: FulfillmentStage;
  orderedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  backorderedQuantity: number;
  remainingQuantity: number;
  receivedPercent: number;
  committedCost: number;
  receivedCost: number;
  risk: "none" | "attention" | "critical";
  riskReason: string | null;
};

function roundMoney(value: number) { return Number(value.toFixed(2)); }

export function summarizePurchaseOrderFulfillment(order: ProcurementPurchaseOrder, lines: ProcurementPurchaseOrderLine[]): PurchaseOrderFulfillment {
  const scoped = lines.filter((line) => line.purchaseOrderId === order.id);
  const totals = scoped.reduce((acc, line) => {
    acc.ordered += line.quantityOrdered;
    acc.received += line.quantityReceived;
    acc.damaged += line.quantityDamaged;
    acc.backordered += line.quantityBackordered;
    acc.receivedCost += line.quantityReceived * line.unitCost;
    return acc;
  }, { ordered: 0, received: 0, damaged: 0, backordered: 0, receivedCost: 0 });
  const remaining = Math.max(0, totals.ordered - totals.received - totals.damaged);
  const receivedPercent = totals.ordered > 0 ? Math.min(100, (totals.received / totals.ordered) * 100) : 0;
  let stage: FulfillmentStage = order.status === "draft" ? "ready_to_order" : order.status === "approved" ? "ready_to_order" : order.status === "issued" ? "ordered" : order.status === "partially_received" ? "partially_received" : order.status === "fully_received" ? "received" : "cancelled";
  let risk: PurchaseOrderFulfillment["risk"] = "none";
  let riskReason: string | null = null;
  if (totals.damaged > 0) { risk = "critical"; riskReason = `${totals.damaged} damaged unit${totals.damaged === 1 ? "" : "s"} require resolution.`; }
  else if (totals.backordered > 0) { risk = "attention"; riskReason = `${totals.backordered} unit${totals.backordered === 1 ? "" : "s"} backordered.`; }
  else if ((order.status === "issued" || order.status === "partially_received") && remaining > 0) { risk = "attention"; riskReason = `${remaining} unit${remaining === 1 ? "" : "s"} still outstanding.`; }
  return { purchaseOrderId: order.id, stage, orderedQuantity: totals.ordered, receivedQuantity: totals.received, damagedQuantity: totals.damaged, backorderedQuantity: totals.backordered, remainingQuantity: remaining, receivedPercent: Number(receivedPercent.toFixed(1)), committedCost: roundMoney(order.totalAmount), receivedCost: roundMoney(totals.receivedCost), risk, riskReason };
}

export function buildFulfillmentDashboard(payload: ProcurementOverviewPayload) {
  const orders = payload.purchaseOrders.map((order) => ({ order, fulfillment: summarizePurchaseOrderFulfillment(order, payload.lineItems) }));
  return {
    orders,
    totals: {
      committedCost: roundMoney(orders.filter(({ order }) => order.status !== "cancelled").reduce((sum, { fulfillment }) => sum + fulfillment.committedCost, 0)),
      receivedCost: roundMoney(orders.reduce((sum, { fulfillment }) => sum + fulfillment.receivedCost, 0)),
      outstandingUnits: orders.reduce((sum, { fulfillment }) => sum + fulfillment.remainingQuantity, 0),
      atRiskOrders: orders.filter(({ fulfillment }) => fulfillment.risk !== "none").length,
    },
  };
}

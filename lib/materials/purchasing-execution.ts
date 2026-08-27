import type { CreatePurchaseOrderInput } from "./procurement-types";
import type { EstimateToOrderPlan } from "./estimate-to-order-automation";
import type { ProjectMaterialPlanItem } from "./project-material-plan-types";

export type PurchasingExecutionDraft = {
  vendorId: string;
  vendorName: string;
  subtotal: number;
  lineCount: number;
  input: CreatePurchaseOrderInput;
};

export type PurchasingExecutionPlan = {
  drafts: PurchasingExecutionDraft[];
  blockedItemIds: string[];
  readyToPrepare: boolean;
  requiresApproval: true;
  supplierSubmissionAllowed: false;
};

/**
 * Converts an approved estimate-to-order recommendation into controlled draft POs.
 * This function intentionally never approves, issues, or submits an order to a supplier.
 */
export function buildPurchasingExecutionPlan(
  projectId: string,
  plan: EstimateToOrderPlan,
  materialItems: ProjectMaterialPlanItem[],
): PurchasingExecutionPlan {
  const itemById = new Map(materialItems.map((item) => [item.id, item]));
  const lineById = new Map(plan.lines.map((line) => [line.itemId, line]));
  const blockedItemIds = plan.lines
    .filter((line) => line.readiness === "needs_supplier_price")
    .map((line) => line.itemId);

  const drafts = plan.groups.map((group): PurchasingExecutionDraft => {
    const lines = group.lineIds.map((itemId) => {
      const recommendation = lineById.get(itemId);
      const material = itemById.get(itemId);
      if (!recommendation || !material || recommendation.quantity <= 0) {
        throw new Error(`Purchasing plan references an invalid material line: ${itemId}`);
      }
      return {
        projectMaterialPlanItemId: material.id,
        materialId: material.materialId,
        description: material.description,
        quantityOrdered: recommendation.quantity,
        unitCost: recommendation.unitCost,
        projectId,
        costCodeId: null,
      };
    });

    return {
      vendorId: group.vendorId,
      vendorName: group.vendorName,
      subtotal: group.subtotal,
      lineCount: lines.length,
      input: {
        vendorId: group.vendorId,
        projectId,
        costCodeId: null,
        taxAmount: 0,
        shippingAmount: 0,
        notes: "Prepared by B.O.S. Estimate-to-Order Automation. Review and approve before issuing.",
        requestId: null,
        attachments: [],
        lines,
      },
    };
  });

  return {
    drafts,
    blockedItemIds,
    readyToPrepare: drafts.length > 0 && blockedItemIds.length === 0,
    requiresApproval: true,
    supplierSubmissionAllowed: false,
  };
}

export type ProcurementStatus =
  | "requested"
  | "approved"
  | "ordered"
  | "confirmed"
  | "ready"
  | "partially_received"
  | "received"
  | "cancelled";

export type ProcurementLine = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  receivedQuantity: number;
};

export type SupplierOffer = {
  supplierId: string;
  supplierName: string;
  materialSubtotal: number;
  deliveryCost: number;
  available: boolean;
  etaDays: number | null;
};

export type PurchaseApproval = {
  approvedBy: string | null;
  approvedAt: string | null;
  budgetConfirmed: boolean;
};

export function directCost(lines: ProcurementLine[]) {
  return lines.reduce((total, line) => total + line.quantity * line.unitCost, 0);
}

export function receivedCost(lines: ProcurementLine[]) {
  return lines.reduce((total, line) => total + Math.min(line.quantity, line.receivedQuantity) * line.unitCost, 0);
}

export function receivingStatus(lines: ProcurementLine[]): ProcurementStatus {
  if (!lines.length || lines.every((line) => line.receivedQuantity <= 0)) return "ordered";
  if (lines.every((line) => line.receivedQuantity >= line.quantity)) return "received";
  return "partially_received";
}

export function rankSupplierOffers(offers: SupplierOffer[]) {
  return [...offers]
    .filter((offer) => offer.available)
    .sort((a, b) => {
      const landedA = a.materialSubtotal + a.deliveryCost;
      const landedB = b.materialSubtotal + b.deliveryCost;
      if (landedA !== landedB) return landedA - landedB;
      return (a.etaDays ?? Number.MAX_SAFE_INTEGER) - (b.etaDays ?? Number.MAX_SAFE_INTEGER);
    });
}

export function authorizeProcurement(input: {
  approval: PurchaseApproval;
  directCost: number;
  projectBudgetRemaining: number;
  duplicateOrderDetected: boolean;
}) {
  const blockers: string[] = [];
  if (!input.approval.approvedBy || !input.approval.approvedAt) blockers.push("Explicit human approval is required.");
  if (!input.approval.budgetConfirmed) blockers.push("Project budget must be confirmed before ordering.");
  if (input.directCost > input.projectBudgetRemaining) blockers.push("Purchase exceeds remaining project budget.");
  if (input.duplicateOrderDetected) blockers.push("Potential duplicate material order detected.");
  return { authorized: blockers.length === 0, blockers };
}

export function procurementVariance(estimatedMaterialCost: number, committedCost: number) {
  return {
    amount: committedCost - estimatedMaterialCost,
    percent: estimatedMaterialCost > 0 ? ((committedCost - estimatedMaterialCost) / estimatedMaterialCost) * 100 : null,
  };
}

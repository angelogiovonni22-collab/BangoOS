import { authorizeProcurement, type ProcurementLine, type PurchaseApproval } from "./procurement-intelligence";
import { authorizeSupplierOrderSubmission, type SupplierOrderCapability } from "./supplier-order-integration";

export function authorizeProcurementSubmission(input: {
  purchaseOrderId: string;
  lines: ProcurementLine[];
  approval: PurchaseApproval;
  projectBudgetRemaining: number;
  duplicateOrderDetected: boolean;
  supplier: SupplierOrderCapability;
}) {
  const directCost = input.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const procurement = authorizeProcurement({
    approval: input.approval,
    directCost,
    projectBudgetRemaining: input.projectBudgetRemaining,
    duplicateOrderDetected: input.duplicateOrderDetected,
  });

  if (!procurement.authorized) return { authorized: false, blockers: procurement.blockers, stage: "procurement" as const };

  const supplier = authorizeSupplierOrderSubmission({
    purchaseOrderId: input.purchaseOrderId,
    approved: true,
    approvalConfirmedAt: input.approval.approvedAt,
    capability: input.supplier,
  });

  return { authorized: supplier.authorized, blockers: supplier.blockers, stage: "supplier" as const };
}

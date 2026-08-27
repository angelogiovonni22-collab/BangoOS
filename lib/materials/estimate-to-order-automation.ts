import type { ProjectMaterialPlanItem } from "./project-material-plan-types";
import type { SupplierPriceComparison } from "./supplier-price-comparison";

export type EstimateToOrderLine = {
  itemId: string;
  description: string;
  quantity: number;
  vendorId: string | null;
  vendorName: string | null;
  supplierPriceEntryId: string | null;
  unitCost: number;
  extendedCost: number;
  savingsAgainstCurrent: number;
  readiness: "ready" | "needs_supplier_price" | "already_fulfilled";
};

export type EstimateToOrderPlan = {
  lines: EstimateToOrderLine[];
  groups: Array<{ vendorId: string; vendorName: string; lineIds: string[]; subtotal: number }>;
  totals: { remainingUnits: number; plannedCost: number; savingsAgainstCurrent: number; readyLines: number; blockedLines: number };
};

const money = (value: number) => Number(value.toFixed(2));

export function buildEstimateToOrderPlan(
  items: ProjectMaterialPlanItem[],
  comparisons: Record<string, SupplierPriceComparison>,
): EstimateToOrderPlan {
  const lines = items.map((item): EstimateToOrderLine => {
    if (item.quantityRemaining <= 0) {
      return { itemId: item.id, description: item.description, quantity: 0, vendorId: item.selectedVendorId, vendorName: item.selectedVendorName, supplierPriceEntryId: null, unitCost: item.currentUnitCost, extendedCost: 0, savingsAgainstCurrent: 0, readiness: "already_fulfilled" };
    }
    const comparison = comparisons[item.id];
    const selected = comparison?.selected ?? comparison?.best ?? null;
    const unitCost = selected?.effectiveUnitCost ?? item.currentUnitCost;
    return {
      itemId: item.id,
      description: item.description,
      quantity: item.quantityRemaining,
      vendorId: selected?.vendorId ?? item.selectedVendorId,
      vendorName: selected?.vendorName ?? item.selectedVendorName,
      supplierPriceEntryId: selected?.entryId ?? null,
      unitCost,
      extendedCost: money(unitCost * item.quantityRemaining),
      savingsAgainstCurrent: money(Math.max(0, item.currentUnitCost - unitCost) * item.quantityRemaining),
      readiness: selected || item.selectedVendorId ? "ready" : "needs_supplier_price",
    };
  });

  const grouped = new Map<string, { vendorId: string; vendorName: string; lineIds: string[]; subtotal: number }>();
  for (const line of lines) {
    if (line.readiness !== "ready" || !line.vendorId) continue;
    const current = grouped.get(line.vendorId) ?? { vendorId: line.vendorId, vendorName: line.vendorName ?? "Supplier", lineIds: [], subtotal: 0 };
    current.lineIds.push(line.itemId);
    current.subtotal += line.extendedCost;
    grouped.set(line.vendorId, current);
  }
  const groups = [...grouped.values()].map((group) => ({ ...group, subtotal: money(group.subtotal) }));
  return {
    lines,
    groups,
    totals: {
      remainingUnits: lines.reduce((sum, line) => sum + line.quantity, 0),
      plannedCost: money(lines.reduce((sum, line) => sum + line.extendedCost, 0)),
      savingsAgainstCurrent: money(lines.reduce((sum, line) => sum + line.savingsAgainstCurrent, 0)),
      readyLines: lines.filter((line) => line.readiness === "ready").length,
      blockedLines: lines.filter((line) => line.readiness === "needs_supplier_price").length,
    },
  };
}

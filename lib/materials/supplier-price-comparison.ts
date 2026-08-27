export type SupplierPriceOption = {
  entryId: string;
  vendorId: string;
  vendorName: string;
  supplierSku: string;
  description: string;
  unitOfMeasure: string;
  effectiveUnitCost: number;
  listName: string;
  branchName: string | null;
  effectiveOn: string;
  verifiedOn: string;
  availability: string | null;
};

export type SupplierPriceComparison = {
  options: SupplierPriceOption[];
  best: SupplierPriceOption | null;
  selected: SupplierPriceOption | null;
  potentialSavings: number;
};

export function effectiveSupplierUnitCost(unitPrice: number, contractorPrice: number | null) {
  return contractorPrice ?? unitPrice;
}

export function compareSupplierPrices(
  options: SupplierPriceOption[],
  selectedEntryId: string | null,
): SupplierPriceComparison {
  const sorted = [...options].sort((a, b) => {
    if (a.effectiveUnitCost !== b.effectiveUnitCost) return a.effectiveUnitCost - b.effectiveUnitCost;
    return b.verifiedOn.localeCompare(a.verifiedOn);
  });
  const best = sorted[0] ?? null;
  const selected = selectedEntryId ? sorted.find((option) => option.entryId === selectedEntryId) ?? null : null;
  return {
    options: sorted,
    best,
    selected,
    potentialSavings: best && selected ? Math.max(0, selected.effectiveUnitCost - best.effectiveUnitCost) : 0,
  };
}

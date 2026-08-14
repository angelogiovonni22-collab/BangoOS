import type { EstimateDiscountType, EstimateLineItemDraft, EstimateTotals } from "@/lib/estimates/types";

function safeToNumber(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value || 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineItemMoney(item: EstimateLineItemDraft) {
  const quantity = Math.max(0, safeToNumber(item.quantity));
  const unitCost = Math.max(0, safeToNumber(item.unitCost));
  const markupPercent = Math.max(0, safeToNumber(item.markupPercent));

  const baseCost = quantity * unitCost;
  const markupAmount = baseCost * (markupPercent / 100);
  const unitPrice = unitCost + unitCost * (markupPercent / 100);
  const lineTotal = baseCost + markupAmount;

  return {
    quantity,
    unitCost,
    markupPercent,
    baseCost,
    markupAmount,
    unitPrice,
    lineTotal,
  };
}

export function calculateEstimateTotals(params: {
  lineItems: EstimateLineItemDraft[];
  discountType: EstimateDiscountType;
  discountValue: string | number;
  taxRatePercent: string | number;
  additionalFee: string | number;
}): EstimateTotals {
  const directCostSubtotalRaw = params.lineItems.reduce((sum, lineItem) => {
    const breakdown = lineItemMoney(lineItem);
    return sum + breakdown.baseCost;
  }, 0);

  const markupTotalRaw = params.lineItems.reduce((sum, lineItem) => {
    const breakdown = lineItemMoney(lineItem);
    return sum + breakdown.markupAmount;
  }, 0);

  const estimateSubtotalRaw = directCostSubtotalRaw + markupTotalRaw;
  const safeDiscountValue = Math.max(0, safeToNumber(params.discountValue));

  let discountTotalRaw = 0;

  if (params.discountType === "percentage") {
    discountTotalRaw = estimateSubtotalRaw * (safeDiscountValue / 100);
  }

  if (params.discountType === "fixed") {
    discountTotalRaw = safeDiscountValue;
  }

  if (discountTotalRaw > estimateSubtotalRaw) {
    discountTotalRaw = estimateSubtotalRaw;
  }

  const taxableSubtotalRaw = Math.max(0, estimateSubtotalRaw - discountTotalRaw);
  const taxRatePercent = Math.max(0, safeToNumber(params.taxRatePercent));
  const taxTotalRaw = taxableSubtotalRaw * (taxRatePercent / 100);
  const additionalFeeRaw = Math.max(0, safeToNumber(params.additionalFee));
  const grandTotalRaw = taxableSubtotalRaw + taxTotalRaw + additionalFeeRaw;

  return {
    directCostSubtotal: roundMoney(directCostSubtotalRaw),
    markupTotal: roundMoney(markupTotalRaw),
    estimateSubtotal: roundMoney(estimateSubtotalRaw),
    discountTotal: roundMoney(discountTotalRaw),
    taxableSubtotal: roundMoney(taxableSubtotalRaw),
    taxTotal: roundMoney(taxTotalRaw),
    additionalFee: roundMoney(additionalFeeRaw),
    grandTotal: roundMoney(grandTotalRaw),
  };
}

export function formatUsd(value: number, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

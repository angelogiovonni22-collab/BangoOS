import type { ChangeOrderLineItemDraft, ChangeOrderTotals } from "@/lib/change-orders/types";

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

export function changeOrderLineItemMoney(item: ChangeOrderLineItemDraft) {
  const quantity = Math.max(0, safeToNumber(item.quantity));
  const unitCost = Math.max(0, safeToNumber(item.unitCost));
  const unitPrice = Math.max(0, safeToNumber(item.unitPrice));

  const costAmount = quantity * unitCost;
  const priceAmount = quantity * unitPrice;

  return {
    quantity,
    unitCost,
    unitPrice,
    costAmount,
    priceAmount,
  };
}

export function calculateChangeOrderTotals(params: {
  lineItems: ChangeOrderLineItemDraft[];
  taxRatePercent: string | number;
}): ChangeOrderTotals {
  const subtotalRaw = params.lineItems.reduce((sum, lineItem) => {
    const breakdown = changeOrderLineItemMoney(lineItem);
    return sum + breakdown.priceAmount;
  }, 0);

  const estimatedCostRaw = params.lineItems.reduce((sum, lineItem) => {
    const breakdown = changeOrderLineItemMoney(lineItem);
    return sum + breakdown.costAmount;
  }, 0);

  const taxRatePercent = Math.max(0, safeToNumber(params.taxRatePercent));
  const taxTotalRaw = subtotalRaw * (taxRatePercent / 100);
  const grandTotalRaw = subtotalRaw + taxTotalRaw;
  const estimatedGrossProfitRaw = subtotalRaw - estimatedCostRaw;
  const estimatedMarginPercentRaw = subtotalRaw > 0 ? (estimatedGrossProfitRaw / subtotalRaw) * 100 : 0;

  return {
    subtotal: roundMoney(subtotalRaw),
    taxTotal: roundMoney(taxTotalRaw),
    grandTotal: roundMoney(grandTotalRaw),
    estimatedCost: roundMoney(estimatedCostRaw),
    estimatedGrossProfit: roundMoney(estimatedGrossProfitRaw),
    estimatedMarginPercent: roundMoney(estimatedMarginPercentRaw),
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

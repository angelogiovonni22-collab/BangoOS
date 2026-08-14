import type { InvoiceDiscountType, InvoiceLineItemDraft, InvoiceTotals } from "@/lib/invoices/types";

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

export function invoiceLineItemMoney(item: InvoiceLineItemDraft) {
  const quantity = Math.max(0, safeToNumber(item.quantity));
  const rate = Math.max(0, safeToNumber(item.rate));
  const amount = quantity * rate;

  return {
    quantity,
    rate,
    amount,
  };
}

export function calculateInvoiceTotals(params: {
  lineItems: InvoiceLineItemDraft[];
  discountType: InvoiceDiscountType;
  discountValue: string | number;
  taxRatePercent: string | number;
  additionalFee: string | number;
}): InvoiceTotals {
  const subtotalRaw = params.lineItems.reduce((sum, lineItem) => {
    const breakdown = invoiceLineItemMoney(lineItem);
    return sum + breakdown.amount;
  }, 0);

  const safeDiscountValue = Math.max(0, safeToNumber(params.discountValue));

  let discountTotalRaw = 0;

  if (params.discountType === "percentage") {
    discountTotalRaw = subtotalRaw * (safeDiscountValue / 100);
  }

  if (params.discountType === "fixed") {
    discountTotalRaw = safeDiscountValue;
  }

  if (discountTotalRaw > subtotalRaw) {
    discountTotalRaw = subtotalRaw;
  }

  const taxableSubtotalRaw = Math.max(0, subtotalRaw - discountTotalRaw);
  const taxRatePercent = Math.max(0, safeToNumber(params.taxRatePercent));
  const taxTotalRaw = taxableSubtotalRaw * (taxRatePercent / 100);
  const additionalFeeRaw = Math.max(0, safeToNumber(params.additionalFee));
  const grandTotalRaw = taxableSubtotalRaw + taxTotalRaw + additionalFeeRaw;

  return {
    subtotal: roundMoney(subtotalRaw),
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

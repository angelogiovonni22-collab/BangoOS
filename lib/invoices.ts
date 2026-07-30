import { INVOICE_STATUSES } from "@/lib/invoices/statuses";

export function normalizeInvoiceStatus(status: string | null) {
  const normalized = status?.trim().toLowerCase();
  const canonical = normalized === "partial" ? "partially_paid" : normalized;

  const matchedStatus = INVOICE_STATUSES.find(
    (invoiceStatus) => invoiceStatus.value === canonical,
  );

  if (matchedStatus) {
    return {
      key: matchedStatus.value,
      label: matchedStatus.label,
    };
  }

  return {
    key: canonical || "draft",
    label: toTitleCase((canonical || "draft").replace(/_/g, " ")),
  };
}

export function formatInvoiceCurrency(
  value: number | null,
  locale = "en-US",
  missingLabel = "Not provided",
) {
  if (typeof value !== "number") {
    return missingLabel;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatInvoiceDate(
  value: string | null,
  locale = "en-US",
  missingLabel = "Not provided",
) {
  if (!value) {
    return missingLabel;
  }

  const normalizedValue = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return missingLabel;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function getInvoiceNumber(invoiceNumber: string | null) {
  const normalized = invoiceNumber?.trim() || "";

  return normalized || "Not assigned";
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

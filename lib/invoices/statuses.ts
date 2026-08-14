export const INVOICE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
] as const;

export function formatInvoiceStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  const matched = INVOICE_STATUSES.find((item) => item.value === normalized);

  if (matched) {
    return matched.label;
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeInvoiceStatus(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "partial") {
    return "partially_paid";
  }

  return normalized;
}

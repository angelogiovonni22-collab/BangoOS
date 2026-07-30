export const CHANGE_ORDER_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "invoiced", label: "Invoiced" },
  { value: "void", label: "Void" },
] as const;

export function formatChangeOrderStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  const matched = CHANGE_ORDER_STATUSES.find((item) => item.value === normalized);

  if (matched) {
    return matched.label;
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeChangeOrderStatus(status: string) {
  return status.trim().toLowerCase();
}

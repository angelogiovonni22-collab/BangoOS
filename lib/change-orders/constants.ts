import type { ChangeOrderStatus, ChangeOrderUnit } from "@/lib/change-orders/types";

export const CHANGE_ORDER_UNIT_OPTIONS: Array<{ value: ChangeOrderUnit; label: string }> = [
  { value: "each", label: "Each" },
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "square_foot", label: "Square Foot" },
  { value: "linear_foot", label: "Linear Foot" },
  { value: "cubic_yard", label: "Cubic Yard" },
  { value: "lump_sum", label: "Lump Sum" },
];

export const CHANGE_ORDER_STATUS_OPTIONS: Array<{ value: ChangeOrderStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "invoiced", label: "Invoiced" },
  { value: "void", label: "Void" },
];

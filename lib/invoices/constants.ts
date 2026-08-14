import type { InvoiceStatus, InvoiceUnit } from "@/lib/invoices/types";

export const INVOICE_UNIT_OPTIONS: Array<{ value: InvoiceUnit; label: string }> = [
  { value: "each", label: "Each" },
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "square_foot", label: "Square Foot" },
  { value: "linear_foot", label: "Linear Foot" },
  { value: "cubic_yard", label: "Cubic Yard" },
  { value: "lump_sum", label: "Lump Sum" },
];

export const INVOICE_STATUS_OPTIONS: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
];

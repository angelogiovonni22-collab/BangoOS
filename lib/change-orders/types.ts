import type { Database } from "@/types/database.types";

export type ChangeOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "invoiced"
  | "void";

export type ChangeOrderUnit =
  | "each"
  | "hour"
  | "day"
  | "week"
  | "square_foot"
  | "linear_foot"
  | "cubic_yard"
  | "lump_sum";

export type ChangeOrderLinkType = "manual" | "converted" | "partial";

export type ChangeOrderVisibility = "internal" | "customer";

export type ChangeOrderActivityType =
  | "created"
  | "updated"
  | "submitted"
  | "approved"
  | "rejected"
  | "reopened"
  | "invoiced"
  | "archived"
  | "restored"
  | "status_changed"
  | "note_added";

export type ChangeOrderRow = Database["public"]["Tables"]["change_orders"]["Row"];
export type ChangeOrderInsert = Database["public"]["Tables"]["change_orders"]["Insert"];
export type ChangeOrderUpdate = Database["public"]["Tables"]["change_orders"]["Update"];

export type ChangeOrderLineItemRow = Database["public"]["Tables"]["change_order_line_items"]["Row"];
export type ChangeOrderLineItemInsert = Database["public"]["Tables"]["change_order_line_items"]["Insert"];

export type ChangeOrderNoteRow = Database["public"]["Tables"]["change_order_notes"]["Row"];
export type ChangeOrderActivityRow = Database["public"]["Tables"]["change_order_activity"]["Row"];
export type ChangeOrderInvoiceLinkRow = Database["public"]["Tables"]["change_order_invoice_links"]["Row"];

export type ChangeOrderLineItemDraft = {
  id: string;
  sortOrder: number;
  description: string;
  quantity: string;
  unit: ChangeOrderUnit;
  unitCost: string;
  unitPrice: string;
  notes: string;
};

export type ChangeOrderTotals = {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  estimatedCost: number;
  estimatedGrossProfit: number;
  estimatedMarginPercent: number;
};

export type ChangeOrderFormValues = {
  title: string;
  changeOrderNumber: string;
  status: ChangeOrderStatus;
  requestedDate: string;
  effectiveDate: string;
  preparedBy: string;
  requestedBy: string;
  customerId: string;
  projectId: string;
  estimateId: string;
  description: string;
  reason: string;
  scheduleImpactDays: string;
  taxRatePercent: string;
  customerNotes: string;
  internalNotes: string;
};

export type ChangeOrderFormErrors = Partial<Record<keyof ChangeOrderFormValues | `lineItems.${number}` | "lineItems", string>>;

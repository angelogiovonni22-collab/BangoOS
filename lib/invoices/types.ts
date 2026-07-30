import type { Database } from "@/types/database.types";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export type InvoiceUnit =
  | "each"
  | "hour"
  | "day"
  | "week"
  | "square_foot"
  | "linear_foot"
  | "cubic_yard"
  | "lump_sum";

export type InvoiceDiscountType = "none" | "percentage" | "fixed";

export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"];
export type InvoiceUpdate = Database["public"]["Tables"]["invoices"]["Update"];

export type InvoiceLineItemRow = Database["public"]["Tables"]["invoice_line_items"]["Row"];
export type InvoiceLineItemInsert = Database["public"]["Tables"]["invoice_line_items"]["Insert"];

export type InvoicePaymentRow = Database["public"]["Tables"]["invoice_payment_history"]["Row"];

export type InvoiceLineItemDraft = {
  id: string;
  sortOrder: number;
  description: string;
  quantity: string;
  unit: InvoiceUnit;
  rate: string;
  notes: string;
};

export type InvoiceTotals = {
  subtotal: number;
  discountTotal: number;
  taxableSubtotal: number;
  taxTotal: number;
  additionalFee: number;
  grandTotal: number;
};

export type InvoiceFormValues = {
  title: string;
  invoiceNumber: string;
  customerId: string;
  projectId: string;
  estimateId: string;
  preparedBy: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  description: string;
  discountType: InvoiceDiscountType;
  discountValue: string;
  taxRatePercent: string;
  additionalFee: string;
  notes: string;
  paymentTerms: string;
};

export type InvoiceFormErrors = Partial<Record<keyof InvoiceFormValues | `lineItems.${number}`, string>>;

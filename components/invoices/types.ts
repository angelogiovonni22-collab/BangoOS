import type {
  InvoiceDiscountType,
  InvoiceFormValues,
  InvoiceLineItemDraft,
  InvoiceStatus,
  InvoiceTotals,
  InvoiceUnit,
} from "@/lib/invoices/types";

export type {
  InvoiceDiscountType,
  InvoiceFormValues,
  InvoiceLineItemDraft,
  InvoiceStatus,
  InvoiceTotals,
  InvoiceUnit,
};

export type InvoiceDirectoryItem = {
  id: string;
  invoiceNumber: string;
  title: string;
  customerName: string;
  customerId: string | null;
  projectName: string;
  projectId: string | null;
  status: InvoiceStatus | string;
  issueDate: string | null;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  updatedAt: string;
};

export type InvoiceFormMode = "create" | "edit";

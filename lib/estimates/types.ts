import type { Database } from "@/types/database.types";

export type EstimateStatus =
  | "draft"
  | "internal_review"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected"
  | "expired"
  | "archived"
  | "ready"
  | "revision_requested"
  | "void"
  | "superseded";

export type EstimateLineCategory =
  | "labor"
  | "materials"
  | "equipment"
  | "subcontractors"
  | "general_conditions"
  | "permits_fees"
  | "other";

export type EstimateUnit =
  | "each"
  | "hour"
  | "day"
  | "week"
  | "square_foot"
  | "linear_foot"
  | "cubic_yard"
  | "lump_sum";

export type EstimateDiscountType = "none" | "percentage" | "fixed";

export type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
export type EstimateInsert = Database["public"]["Tables"]["estimates"]["Insert"];
export type EstimateUpdate = Database["public"]["Tables"]["estimates"]["Update"];

export type EstimateLineItemRow = Database["public"]["Tables"]["estimate_line_items"]["Row"];
export type EstimateLineItemInsert = Database["public"]["Tables"]["estimate_line_items"]["Insert"];

export type EstimateLineItemDraft = {
  id: string;
  sortOrder: number;
  itemCode: string;
  category: EstimateLineCategory;
  description: string;
  quantity: string;
  unit: EstimateUnit;
  unitCost: string;
  markupPercent: string;
  notes: string;
};

export type EstimateTotals = {
  directCostSubtotal: number;
  markupTotal: number;
  estimateSubtotal: number;
  discountTotal: number;
  taxableSubtotal: number;
  taxTotal: number;
  additionalFee: number;
  grandTotal: number;
};

export type EstimateFormValues = {
  title: string;
  estimateNumber: string;
  customerId: string;
  projectId: string;
  issueDate: string;
  expirationDate: string;
  preparedBy: string;
  status: EstimateStatus;
  description: string;
  discountType: EstimateDiscountType;
  discountValue: string;
  taxRatePercent: string;
  additionalFee: string;
  internalNotes: string;
  customerNotes: string;
  scopeInclusions: string;
  scopeExclusions: string;
  terms: string;
  paymentTerms: string;
};

export type EstimateFormErrors = Partial<Record<keyof EstimateFormValues | `lineItems.${number}`, string>>;

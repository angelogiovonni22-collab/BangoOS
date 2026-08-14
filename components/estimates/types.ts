import type {
  EstimateDiscountType,
  EstimateFormValues,
  EstimateLineCategory,
  EstimateLineItemDraft,
  EstimateStatus,
  EstimateTotals,
  EstimateUnit,
} from "@/lib/estimates/types";

export type { EstimateDiscountType, EstimateFormValues, EstimateLineItemDraft, EstimateTotals, EstimateStatus, EstimateLineCategory, EstimateUnit };

export type EstimateDirectoryItem = {
  id: string;
  estimateNumber: string;
  title: string;
  customerName: string;
  customerId: string | null;
  projectName: string;
  projectId: string | null;
  status: EstimateStatus | string;
  issueDate: string | null;
  expirationDate: string | null;
  totalAmount: number;
  updatedAt: string;
};

export type EstimateFormMode = "create" | "edit";

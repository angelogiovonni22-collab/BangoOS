import type {
  ChangeOrderFormValues,
  ChangeOrderLineItemDraft,
  ChangeOrderStatus,
  ChangeOrderTotals,
  ChangeOrderUnit,
} from "@/lib/change-orders/types";

export type {
  ChangeOrderFormValues,
  ChangeOrderLineItemDraft,
  ChangeOrderStatus,
  ChangeOrderTotals,
  ChangeOrderUnit,
};

export type ChangeOrderDirectoryItem = {
  id: string;
  changeOrderNumber: string;
  title: string;
  customerName: string;
  customerId: string | null;
  projectName: string;
  projectId: string | null;
  status: ChangeOrderStatus | string;
  scheduleImpactDays: number;
  totalAmount: number;
  requestedDate: string | null;
  updatedAt: string;
  archivedAt: string | null;
  description: string | null;
};

export type ChangeOrderFormMode = "create" | "edit";

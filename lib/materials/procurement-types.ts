export const PROCUREMENT_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "converted",
  "cancelled",
] as const;

export type ProcurementRequestStatus = (typeof PROCUREMENT_REQUEST_STATUSES)[number];

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "approved",
  "issued",
  "partially_received",
  "fully_received",
  "cancelled",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export type ProcurementMaterialRequest = {
  id: string;
  requestNumber: string;
  projectId: string;
  projectName: string;
  requestedBy: string | null;
  priority: "low" | "normal" | "high" | "critical";
  status: ProcurementRequestStatus;
  neededByDate: string | null;
  notes: string | null;
  createdAt: string;
};

export type ProcurementPurchaseOrder = {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  costCodeId: string | null;
  costCodeLabel: string | null;
  status: PurchaseOrderStatus;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  issuedAt: string | null;
  createdAt: string;
  notes: string | null;
};

export type ProcurementPurchaseOrderLine = {
  id: string;
  purchaseOrderId: string;
  materialId: string | null;
  materialName: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityDamaged: number;
  quantityBackordered: number;
  unitCost: number;
  lineSubtotal: number;
  projectId: string;
  costCodeId: string | null;
};

export type ProcurementProjectSummary = {
  materialsOrdered: number;
  materialsReceived: number;
  outstandingOrders: number;
  materialCost: number;
  pendingDeliveries: number;
};

export type ProcurementVendorSummary = {
  activePurchaseOrders: number;
  orderHistoryCount: number;
  deliveryPerformancePercent: number;
  outstandingBalanceAmount: number;
  associatedProjects: Array<{ id: string; name: string }>;
};

export type ProcurementOverviewPayload = {
  requests: ProcurementMaterialRequest[];
  purchaseOrders: ProcurementPurchaseOrder[];
  lineItems: ProcurementPurchaseOrderLine[];
  vendors: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  materials: Array<{ id: string; name: string; unitOfMeasure: string; currentStock: number }>;
  costCodes: Array<{ id: string; label: string }>;
};

export type CreateMaterialRequestInput = {
  projectId: string;
  priority: "low" | "normal" | "high" | "critical";
  neededByDate: string | null;
  notes: string | null;
};

export type CreatePurchaseOrderInput = {
  vendorId: string;
  projectId: string;
  costCodeId: string | null;
  taxAmount: number;
  shippingAmount: number;
  notes: string | null;
  requestId: string | null;
  attachments: Array<{ name: string; url: string }>;
  lines: Array<{
    materialId: string | null;
    description: string;
    quantityOrdered: number;
    unitCost: number;
    projectId: string;
    costCodeId: string | null;
  }>;
};

export type ReceivePurchaseOrderLineInput = {
  purchaseOrderId: string;
  lineItemId: string;
  quantityReceived: number;
  quantityDamaged: number;
  quantityBackordered: number;
  notes: string | null;
};

export type AllocateMaterialInput = {
  purchaseOrderId: string;
  lineItemId: string;
  materialId: string;
  projectId: string;
  costCodeId: string | null;
  quantityAllocated: number;
  unitCost: number;
  notes: string | null;
};

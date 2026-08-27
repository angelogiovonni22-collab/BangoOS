export type ProjectMaterialPlanStatus =
  | "planned"
  | "ready_to_order"
  | "partially_ordered"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export type ProjectMaterialPlanItem = {
  id: string;
  projectId: string;
  estimateId: string | null;
  materialId: string | null;
  description: string;
  itemCode: string | null;
  unitOfMeasure: string;
  estimatedQuantity: number;
  inventoryAvailable: number;
  inventoryQuantity: number;
  quantityToPurchase: number;
  quantityOrdered: number;
  quantityReceived: number;
  quantityRemaining: number;
  originalUnitCost: number;
  currentUnitCost: number;
  estimatedPurchaseCost: number;
  currentPurchaseCost: number;
  costVariance: number;
  selectedVendorId: string | null;
  selectedVendorName: string | null;
  requiredOn: string | null;
  status: ProjectMaterialPlanStatus;
  orderStatus: "not_ordered" | "draft" | "approved" | "issued" | "partially_received" | "received";
};

export type ProjectMaterialPlanPayload = {
  project: { id: string; name: string };
  items: ProjectMaterialPlanItem[];
  vendors: Array<{ id: string; name: string }>;
};

export type UpdateProjectMaterialPlanInput = {
  itemId: string;
  inventoryQuantity: number;
  requiredOn: string | null;
  selectedVendorId: string | null;
};

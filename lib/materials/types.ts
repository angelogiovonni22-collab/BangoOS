import type { Database } from "@/types/database.types";

export const MATERIAL_STATUSES = ["active", "inactive", "discontinued", "archived"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export type MaterialSortKey =
  | "name_asc"
  | "material_code_asc"
  | "status_asc"
  | "current_stock_desc"
  | "standard_cost_desc"
  | "created_at_desc";

export type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];

export type MaterialFormInput = {
  material_code: string;
  status: MaterialStatus;
  name: string;
  description: string;
  category: string;
  trade: string;
  unit_of_measure: string;
  standard_cost: string;
  average_cost: string;
  last_purchase_cost: string;
  markup_percent: string;
  suggested_sell_price: string;
  preferred_vendor_id: string;
  manufacturer: string;
  manufacturer_part_number: string;
  vendor_part_number: string;
  lead_time_days: string;
  track_inventory: boolean;
  current_stock: string;
  reorder_point: string;
  reorder_quantity: string;
  warehouse_location: string;
  bin_location: string;
  weight: string;
  width: string;
  height: string;
  length: string;
  last_purchase_date: string;
  notes: string;
};

export const EMPTY_MATERIAL_FORM: MaterialFormInput = {
  material_code: "",
  status: "active",
  name: "",
  description: "",
  category: "",
  trade: "",
  unit_of_measure: "each",
  standard_cost: "0",
  average_cost: "0",
  last_purchase_cost: "0",
  markup_percent: "0",
  suggested_sell_price: "0",
  preferred_vendor_id: "",
  manufacturer: "",
  manufacturer_part_number: "",
  vendor_part_number: "",
  lead_time_days: "",
  track_inventory: false,
  current_stock: "0",
  reorder_point: "0",
  reorder_quantity: "0",
  warehouse_location: "",
  bin_location: "",
  weight: "",
  width: "",
  height: "",
  length: "",
  last_purchase_date: "",
  notes: "",
};

export type MaterialListItem = {
  id: string;
  materialCode: string;
  name: string;
  category: string | null;
  trade: string | null;
  status: MaterialStatus;
  unitOfMeasure: string;
  standardCost: number;
  currentStock: number;
  reorderPoint: number;
  trackInventory: boolean;
  preferredVendorId: string | null;
  preferredVendorName: string | null;
  createdAt: string;
};

export type VendorOption = {
  id: string;
  displayName: string;
};

export function getStockBadgeTone(item: Pick<MaterialListItem, "trackInventory" | "currentStock" | "reorderPoint">): "brand" | "warning" | "danger" | "neutral" {
  if (!item.trackInventory) {
    return "neutral";
  }

  if (item.currentStock <= 0) {
    return "danger";
  }

  if (item.currentStock <= item.reorderPoint) {
    return "warning";
  }

  return "brand";
}

export function getStockBadgeLabel(item: Pick<MaterialListItem, "trackInventory" | "currentStock" | "reorderPoint">): string {
  if (!item.trackInventory) {
    return "Not tracked";
  }

  if (item.currentStock <= 0) {
    return "Out of stock";
  }

  if (item.currentStock <= item.reorderPoint) {
    return "Low stock";
  }

  return "In stock";
}

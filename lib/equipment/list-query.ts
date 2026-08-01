import type { CriticalityLevel, CurrentLocationType, EquipmentSortKey, EquipmentStatus, EquipmentType, MaintenanceStatus, OwnershipType, ReplacementPriority } from "./types";

export type EquipmentListFilterState = {
  query: string;
  status: EquipmentStatus | "all";
  equipmentType: EquipmentType | "all";
  category: string;
  ownershipType: OwnershipType | "all";
  vendorId: string;
  maintenanceStatus: MaintenanceStatus | "all";
  locationType: CurrentLocationType | "all";
  defaultCostCodeId: string;
  criticalityLevel: CriticalityLevel | "all";
  replacementPriority: ReplacementPriority | "all";
  assignedJobId: string;
  assignedEmployeeId: string;
  sortBy: EquipmentSortKey;
};

export type EquipmentQueryPlan = {
  searchOr: string | null;
  equals: Array<{ column: string; value: string }>;
  ilike: Array<{ column: string; value: string }>;
};

export function sanitizeEquipmentSearchQuery(query: string) {
  return query.trim().replace(/,/g, " ");
}

export function buildEquipmentQueryPlan(filters: EquipmentListFilterState): EquipmentQueryPlan {
  const equals: Array<{ column: string; value: string }> = [];
  const ilike: Array<{ column: string; value: string }> = [];

  const sanitizedQuery = sanitizeEquipmentSearchQuery(filters.query);
  const searchOr = sanitizedQuery
    ? `equipment_number.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%,manufacturer.ilike.%${sanitizedQuery}%,model.ilike.%${sanitizedQuery}%,serial_number.ilike.%${sanitizedQuery}%,asset_tag.ilike.%${sanitizedQuery}%`
    : null;

  if (filters.status !== "all") equals.push({ column: "status", value: filters.status });
  if (filters.equipmentType !== "all") equals.push({ column: "equipment_type", value: filters.equipmentType });
  if (filters.category.trim()) ilike.push({ column: "category", value: `%${filters.category.trim()}%` });
  if (filters.ownershipType !== "all") equals.push({ column: "ownership_type", value: filters.ownershipType });
  if (filters.vendorId) equals.push({ column: "vendor_id", value: filters.vendorId });
  if (filters.maintenanceStatus !== "all") equals.push({ column: "maintenance_status", value: filters.maintenanceStatus });
  if (filters.locationType !== "all") equals.push({ column: "current_location_type", value: filters.locationType });
  if (filters.defaultCostCodeId) equals.push({ column: "default_cost_code_id", value: filters.defaultCostCodeId });
  if (filters.criticalityLevel !== "all") equals.push({ column: "criticality_level", value: filters.criticalityLevel });
  if (filters.replacementPriority !== "all") equals.push({ column: "replacement_priority", value: filters.replacementPriority });
  if (filters.assignedJobId) equals.push({ column: "assigned_job_id", value: filters.assignedJobId });
  if (filters.assignedEmployeeId) equals.push({ column: "assigned_employee_id", value: filters.assignedEmployeeId });

  return {
    searchOr,
    equals,
    ilike,
  };
}

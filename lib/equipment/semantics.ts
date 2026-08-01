export const PROJECT_WORKSPACE_ASSIGNED_EQUIPMENT_STATUSES = ["active", "maintenance", "out_of_service"] as const;

export const PROJECT_WORKSPACE_EQUIPMENT_CONFLICT_OR_FILTER = "maintenance_status.eq.overdue,status.eq.out_of_service,status.eq.maintenance";

export type EquipmentSemanticSnapshot = {
  status: string;
  maintenanceStatus: string;
  assignedJobId: string | null;
  expectedReturnDate?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export function isEquipmentOutOfService(snapshot: EquipmentSemanticSnapshot) {
  const status = normalize(snapshot.status);
  return status === "out_of_service" || status === "maintenance";
}

export function isEquipmentMaintenanceDue(snapshot: EquipmentSemanticSnapshot) {
  const maintenance = normalize(snapshot.maintenanceStatus);
  return maintenance === "due_soon" || maintenance === "overdue";
}

export function isEquipmentOverdueMaintenance(snapshot: EquipmentSemanticSnapshot) {
  return normalize(snapshot.maintenanceStatus) === "overdue";
}

export function isEquipmentAssigned(snapshot: EquipmentSemanticSnapshot) {
  return Boolean(snapshot.assignedJobId);
}

export function isEquipmentInUse(snapshot: EquipmentSemanticSnapshot) {
  return normalize(snapshot.status) === "active" && isEquipmentAssigned(snapshot);
}

export function isEquipmentAvailable(snapshot: EquipmentSemanticSnapshot) {
  return normalize(snapshot.status) === "active" && !isEquipmentAssigned(snapshot);
}

export function isEquipmentReserved(snapshot: EquipmentSemanticSnapshot) {
  return isEquipmentAvailable(snapshot) && Boolean(snapshot.expectedReturnDate);
}

export function isEquipmentIdle(snapshot: EquipmentSemanticSnapshot) {
  return isEquipmentAvailable(snapshot) && !isEquipmentReserved(snapshot);
}

export function isEquipmentConflict(snapshot: EquipmentSemanticSnapshot) {
  return isEquipmentAssigned(snapshot) && (isEquipmentOutOfService(snapshot) || isEquipmentOverdueMaintenance(snapshot));
}

export function isProjectAssignedEquipmentCounted(snapshot: EquipmentSemanticSnapshot) {
  const status = normalize(snapshot.status);
  return isEquipmentAssigned(snapshot) && PROJECT_WORKSPACE_ASSIGNED_EQUIPMENT_STATUSES.includes(status as (typeof PROJECT_WORKSPACE_ASSIGNED_EQUIPMENT_STATUSES)[number]);
}

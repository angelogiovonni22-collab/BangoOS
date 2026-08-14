import type { EquipmentListItem } from "./types";
import {
  isEquipmentIdle as isEquipmentIdleCanonical,
  isEquipmentInUse as isEquipmentInUseCanonical,
  isEquipmentMaintenanceDue,
  isEquipmentOverdueMaintenance,
  isEquipmentOutOfService,
  isEquipmentReserved as isEquipmentReservedCanonical,
} from "./semantics";

export type FleetDataAvailability = "live" | "partial" | "unavailable";

export type FleetSummaryMetric = {
  id:
    | "totalEquipment"
    | "equipmentInUse"
    | "idleEquipment"
    | "maintenanceDue"
    | "outOfService"
    | "reservedEquipment"
    | "rentedEquipment"
    | "inspectionAlerts"
    | "warrantyAlerts"
    | "recentlyAddedAssets"
    | "recentlyUpdatedAssets";
  label: string;
  value: number;
  availability: FleetDataAvailability;
};

export type EquipmentStatusView = "in_use" | "idle" | "reserved" | "out_of_service";

export type FleetGridRow = {
  equipmentId: string;
  equipmentNumber: string;
  assetName: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  currentProject: string;
  assignedEmployee: string;
  status: string;
  hours: string;
  mileage: string;
  condition: string;
  inspectionStatus: string;
  maintenanceDue: string;
  location: string;
  purchaseDate: string;
  warranty: string;
  qrCodeStatus: string;
  lastActivity: string;
  statusView: EquipmentStatusView;
};

export type FleetOrionRecommendation = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  reason: string;
  equipmentId: string | null;
  href: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(value: string | null) {
  if (!value) {
    return null;
  }

  const target = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.floor((target.getTime() - utcNow.getTime()) / DAY_MS);
}

export function isEquipmentInspectionAlert(item: EquipmentListItem) {
  const days = daysUntil(item.inspectionExpirationDate);
  return days !== null && days <= 30;
}

export function isEquipmentWarrantyAlert(item: EquipmentListItem) {
  const days = daysUntil(item.warrantyExpirationDate);
  return days !== null && days <= 45;
}

function isEquipmentInUse(item: EquipmentListItem) {
  return isEquipmentInUseCanonical(item);
}

function isEquipmentReserved(item: EquipmentListItem) {
  return isEquipmentReservedCanonical(item);
}

function isEquipmentIdle(item: EquipmentListItem) {
  return isEquipmentIdleCanonical(item);
}

export function getEquipmentStatusView(item: EquipmentListItem): EquipmentStatusView {
  if (item.status === "out_of_service" || item.status === "maintenance") {
    return "out_of_service";
  }

  if (isEquipmentInUse(item)) {
    return "in_use";
  }

  if (isEquipmentReserved(item)) {
    return "reserved";
  }

  return "idle";
}

function inspectionStatusLabel(item: EquipmentListItem) {
  const days = daysUntil(item.inspectionExpirationDate);

  if (days === null) {
    return "Unavailable";
  }

  if (days < 0) {
    return "Overdue";
  }

  if (days <= 30) {
    return `Due in ${days}d`;
  }

  return "Current";
}

function warrantyStatusLabel(item: EquipmentListItem) {
  const days = daysUntil(item.warrantyExpirationDate);

  if (days === null) {
    return "Unavailable";
  }

  if (days < 0) {
    return "Expired";
  }

  if (days <= 45) {
    return `Expires in ${days}d`;
  }

  return "Current";
}

function maintenanceDueLabel(item: EquipmentListItem) {
  if (item.nextServiceDate) {
    return item.nextServiceDate;
  }

  return item.maintenanceStatus.replace(/_/g, " ");
}

function conditionLabel(item: EquipmentListItem) {
  if (item.conditionScore === null) {
    return "Unavailable";
  }

  if (item.conditionScore >= 85) {
    return `Excellent (${item.conditionScore})`;
  }

  if (item.conditionScore >= 70) {
    return `Good (${item.conditionScore})`;
  }

  if (item.conditionScore >= 50) {
    return `Watch (${item.conditionScore})`;
  }

  return `Critical (${item.conditionScore})`;
}

export function buildFleetSummaryMetrics(items: EquipmentListItem[]): FleetSummaryMetric[] {
  const now = Date.now();
  const sevenDaysMs = 7 * DAY_MS;

  const totalEquipment = items.length;
  const equipmentInUse = items.filter(isEquipmentInUse).length;
  const idleEquipment = items.filter(isEquipmentIdle).length;
  const maintenanceDue = items.filter(isEquipmentMaintenanceDue).length;
  const outOfService = items.filter(isEquipmentOutOfService).length;
  const reservedEquipment = items.filter(isEquipmentReserved).length;
  const rentedEquipment = items.filter((item) => item.ownershipType === "rented").length;
  const inspectionAlerts = items.filter(isEquipmentInspectionAlert).length;
  const warrantyAlerts = items.filter(isEquipmentWarrantyAlert).length;
  const recentlyAddedAssets = items.filter((item) => now - new Date(item.createdAt).getTime() <= sevenDaysMs).length;
  const recentlyUpdatedAssets = items.filter((item) => now - new Date(item.updatedAt).getTime() <= sevenDaysMs).length;

  return [
    { id: "totalEquipment", label: "Total Equipment", value: totalEquipment, availability: "live" },
    { id: "equipmentInUse", label: "Equipment In Use", value: equipmentInUse, availability: "live" },
    { id: "idleEquipment", label: "Idle Equipment", value: idleEquipment, availability: "live" },
    { id: "maintenanceDue", label: "Maintenance Due", value: maintenanceDue, availability: "live" },
    { id: "outOfService", label: "Out of Service", value: outOfService, availability: "live" },
    { id: "reservedEquipment", label: "Reserved Equipment", value: reservedEquipment, availability: "partial" },
    { id: "rentedEquipment", label: "Rented Equipment", value: rentedEquipment, availability: "live" },
    { id: "inspectionAlerts", label: "Inspection Alerts", value: inspectionAlerts, availability: "live" },
    { id: "warrantyAlerts", label: "Warranty Alerts", value: warrantyAlerts, availability: "live" },
    { id: "recentlyAddedAssets", label: "Recently Added Assets", value: recentlyAddedAssets, availability: "live" },
    { id: "recentlyUpdatedAssets", label: "Recently Updated Assets", value: recentlyUpdatedAssets, availability: "live" },
  ];
}

export function buildFleetGridRows(
  items: EquipmentListItem[],
  projectNameById: Record<string, string>,
  employeeNameById: Record<string, string>,
): FleetGridRow[] {
  return items.map((item) => ({
    equipmentId: item.id,
    equipmentNumber: item.equipmentNumber,
    assetName: item.name,
    category: item.category || item.equipmentType?.replace(/_/g, " ") || "Uncategorized",
    manufacturer: item.manufacturer || "Unavailable",
    model: item.model || "Unavailable",
    serialNumber: item.serialNumber || "Unavailable",
    currentProject: item.assignedJobId ? projectNameById[item.assignedJobId] || "Unavailable" : "Unassigned",
    assignedEmployee: item.assignedEmployeeId ? employeeNameById[item.assignedEmployeeId] || "Unavailable" : "Unassigned",
    status: item.status.replace(/_/g, " "),
    hours: item.lifetimeHours > 0 ? `${item.lifetimeHours.toFixed(1)} h` : "0.0 h",
    mileage: item.lifetimeMiles > 0 ? `${item.lifetimeMiles.toFixed(1)} mi` : "0.0 mi",
    condition: conditionLabel(item),
    inspectionStatus: inspectionStatusLabel(item),
    maintenanceDue: maintenanceDueLabel(item),
    location: item.currentLocationName || item.currentLocationType?.replace(/_/g, " ") || "Unavailable",
    purchaseDate: item.purchaseDate || "Unavailable",
    warranty: warrantyStatusLabel(item),
    qrCodeStatus: item.qrCode ? "Assigned" : "Missing",
    lastActivity: item.updatedAt,
    statusView: getEquipmentStatusView(item),
  }));
}

export function buildFleetOrionRecommendations(items: EquipmentListItem[]): FleetOrionRecommendation[] {
  const recommendations: FleetOrionRecommendation[] = [];

  for (const item of items) {
    if (isEquipmentOverdueMaintenance(item)) {
      recommendations.push({
        id: `maint-${item.id}`,
        title: `${item.equipmentNumber} maintenance overdue`,
        severity: "critical",
        reason: "Service window has passed and asset availability risk is elevated.",
        equipmentId: item.id,
        href: `/equipment/${item.id}`,
      });
    }

    if (isEquipmentIdle(item) && item.ownershipType !== "rented") {
      recommendations.push({
        id: `idle-${item.id}`,
        title: `${item.equipmentNumber} is idle`,
        severity: "medium",
        reason: "Asset has no current assignment and may be under-utilized.",
        equipmentId: item.id,
        href: `/equipment/${item.id}`,
      });
    }

    if (isEquipmentInspectionAlert(item)) {
      recommendations.push({
        id: `insp-${item.id}`,
        title: `${item.equipmentNumber} inspection risk`,
        severity: "high",
        reason: "Inspection expiration is overdue or within 30 days.",
        equipmentId: item.id,
        href: `/equipment/${item.id}`,
      });
    }

    if (isEquipmentWarrantyAlert(item)) {
      recommendations.push({
        id: `warranty-${item.id}`,
        title: `${item.equipmentNumber} warranty alert`,
        severity: "low",
        reason: "Warranty has expired or is approaching expiration.",
        equipmentId: item.id,
        href: `/equipment/${item.id}`,
      });
    }
  }

  const severityOrder: Record<FleetOrionRecommendation["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return recommendations
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title))
    .slice(0, 10);
}

import type { Database } from "@/types/database.types";

export const EQUIPMENT_STATUSES = ["active", "inactive", "maintenance", "out_of_service", "retired", "sold", "lost", "stolen"] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export const EQUIPMENT_TYPES = ["heavy_equipment", "vehicle", "trailer", "power_tool", "hand_tool", "safety_equipment", "office_equipment", "technology", "rented_equipment", "other"] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const OWNERSHIP_TYPES = ["owned", "financed", "leased", "rented", "subcontractor_provided", "employee_owned", "other"] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const CURRENT_LOCATION_TYPES = ["warehouse", "jobsite", "vehicle", "employee", "rental_provider", "repair_shop", "office", "unknown", "other"] as const;
export type CurrentLocationType = (typeof CURRENT_LOCATION_TYPES)[number];

export const METER_TYPES = ["hours", "mileage", "cycles", "none", "other"] as const;
export type MeterType = (typeof METER_TYPES)[number];

export const DEPRECIATION_METHODS = ["straight_line", "declining_balance", "units_of_production", "none", "other"] as const;
export type DepreciationMethod = (typeof DEPRECIATION_METHODS)[number];

export const MAINTENANCE_STATUSES = ["current", "due_soon", "overdue", "in_service", "unavailable", "not_required"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const CRITICALITY_LEVELS = ["low", "standard", "high", "mission_critical"] as const;
export type CriticalityLevel = (typeof CRITICALITY_LEVELS)[number];

export const REPLACEMENT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type ReplacementPriority = (typeof REPLACEMENT_PRIORITIES)[number];

export const CERTIFICATION_STATUSES = ["current", "due_soon", "overdue", "expired", "not_required", "unavailable"] as const;
export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];

export function coerceEquipmentStatus(value: string | null | undefined, fallback: EquipmentStatus = "active"): EquipmentStatus {
  return value === "active" || value === "inactive" || value === "maintenance" || value === "out_of_service" || value === "retired" || value === "sold" || value === "lost" || value === "stolen"
    ? value
    : fallback;
}

export function coerceEquipmentType(value: string | null | undefined): EquipmentType | null {
  return value === "heavy_equipment" || value === "vehicle" || value === "trailer" || value === "power_tool" || value === "hand_tool" || value === "safety_equipment" || value === "office_equipment" || value === "technology" || value === "rented_equipment" || value === "other"
    ? value
    : null;
}

export function coerceOwnershipType(value: string | null | undefined, fallback: OwnershipType = "owned"): OwnershipType {
  return value === "owned" || value === "financed" || value === "leased" || value === "rented" || value === "subcontractor_provided" || value === "employee_owned" || value === "other"
    ? value
    : fallback;
}

export function coerceCurrentLocationType(value: string | null | undefined): CurrentLocationType | null {
  return value === "warehouse" || value === "jobsite" || value === "vehicle" || value === "employee" || value === "rental_provider" || value === "repair_shop" || value === "office" || value === "unknown" || value === "other"
    ? value
    : null;
}

export function coerceMeterType(value: string | null | undefined): MeterType | null {
  return value === "hours" || value === "mileage" || value === "cycles" || value === "none" || value === "other"
    ? value
    : null;
}

export function coerceDepreciationMethod(value: string | null | undefined): DepreciationMethod | null {
  return value === "straight_line" || value === "declining_balance" || value === "units_of_production" || value === "none" || value === "other"
    ? value
    : null;
}

export function coerceMaintenanceStatus(value: string | null | undefined, fallback: MaintenanceStatus = "current"): MaintenanceStatus {
  return value === "current" || value === "due_soon" || value === "overdue" || value === "in_service" || value === "unavailable" || value === "not_required"
    ? value
    : fallback;
}

export function coerceCriticalityLevel(value: string | null | undefined, fallback: CriticalityLevel = "standard"): CriticalityLevel {
  return value === "low" || value === "standard" || value === "high" || value === "mission_critical"
    ? value
    : fallback;
}

export function coerceReplacementPriority(value: string | null | undefined, fallback: ReplacementPriority = "normal"): ReplacementPriority {
  return value === "low" || value === "normal" || value === "high" || value === "urgent"
    ? value
    : fallback;
}

export type EquipmentSortKey =
  | "equipment_number_asc"
  | "name_asc"
  | "equipment_type_asc"
  | "manufacturer_asc"
  | "purchase_price_desc"
  | "current_value_desc"
  | "effective_internal_hourly_cost_desc"
  | "hourly_billable_rate_desc"
  | "maintenance_status_asc"
  | "next_service_date_asc"
  | "updated_at_desc";

export type EquipmentRow = Database["public"]["Tables"]["equipment"]["Row"];

export type EquipmentVendorOption = {
  id: string;
  displayName: string;
};

export type EquipmentCostCodeOption = {
  id: string;
  code: string;
  name: string;
};

export type EquipmentFormInput = {
  equipment_number: string;
  name: string;
  description: string;
  status: EquipmentStatus;
  equipment_type: EquipmentType | "";
  category: string;
  subcategory: string;

  manufacturer: string;
  model: string;
  model_year: string;
  serial_number: string;
  vin: string;
  license_plate: string;
  asset_tag: string;
  barcode: string;
  qr_code: string;

  ownership_type: OwnershipType;
  vendor_id: string;
  owner_name: string;
  lease_start_date: string;
  lease_end_date: string;
  rental_start_date: string;
  rental_end_date: string;
  rental_agreement_number: string;

  current_location_type: CurrentLocationType | "";
  current_location_name: string;
  assigned_job_id: string;
  assigned_employee_id: string;
  assigned_crew_id: string;
  assigned_at: string;
  expected_return_date: string;

  purchase_date: string;
  purchase_price: string;
  current_value: string;
  salvage_value: string;
  financed_amount: string;
  monthly_payment: string;
  lease_monthly_cost: string;
  rental_daily_cost: string;
  rental_weekly_cost: string;
  rental_monthly_cost: string;
  depreciation_method: DepreciationMethod | "";
  useful_life_years: string;
  depreciation_start_date: string;
  warranty_expiration_date: string;

  hourly_internal_cost: string;
  hourly_billable_rate: string;
  daily_internal_cost: string;
  daily_billable_rate: string;
  fuel_type: string;
  estimated_fuel_cost_per_hour: string;
  maintenance_cost_per_hour: string;
  insurance_cost_per_hour: string;
  other_operating_cost_per_hour: string;

  meter_type: MeterType | "";
  current_meter_reading: string;
  meter_unit: string;
  last_meter_updated_at: string;
  lifetime_hours: string;
  lifetime_miles: string;

  maintenance_status: MaintenanceStatus;
  last_service_date: string;
  next_service_date: string;
  last_service_meter: string;
  next_service_meter: string;
  service_interval_days: string;
  service_interval_meter: string;
  maintenance_notes: string;

  registration_expiration_date: string;
  inspection_expiration_date: string;
  insurance_expiration_date: string;
  certification_expiration_date: string;
  requires_operator_certification: boolean;
  required_certification_type: string;
  safety_notes: string;

  default_cost_code_id: string;
  default_unit_of_measure: string;
  default_quantity: string;
  taxable: boolean;

  criticality_level: CriticalityLevel;
  utilization_target_percent: string;
  replacement_priority: ReplacementPriority;
  replacement_score: string;
  condition_score: string;
  reliability_score: string;
  ai_notes: string;

  notes: string;
};

export const EMPTY_EQUIPMENT_FORM: EquipmentFormInput = {
  equipment_number: "",
  name: "",
  description: "",
  status: "active",
  equipment_type: "",
  category: "",
  subcategory: "",

  manufacturer: "",
  model: "",
  model_year: "",
  serial_number: "",
  vin: "",
  license_plate: "",
  asset_tag: "",
  barcode: "",
  qr_code: "",

  ownership_type: "owned",
  vendor_id: "",
  owner_name: "",
  lease_start_date: "",
  lease_end_date: "",
  rental_start_date: "",
  rental_end_date: "",
  rental_agreement_number: "",

  current_location_type: "",
  current_location_name: "",
  assigned_job_id: "",
  assigned_employee_id: "",
  assigned_crew_id: "",
  assigned_at: "",
  expected_return_date: "",

  purchase_date: "",
  purchase_price: "0",
  current_value: "0",
  salvage_value: "0",
  financed_amount: "0",
  monthly_payment: "0",
  lease_monthly_cost: "0",
  rental_daily_cost: "0",
  rental_weekly_cost: "0",
  rental_monthly_cost: "0",
  depreciation_method: "",
  useful_life_years: "",
  depreciation_start_date: "",
  warranty_expiration_date: "",

  hourly_internal_cost: "0",
  hourly_billable_rate: "0",
  daily_internal_cost: "0",
  daily_billable_rate: "0",
  fuel_type: "",
  estimated_fuel_cost_per_hour: "0",
  maintenance_cost_per_hour: "0",
  insurance_cost_per_hour: "0",
  other_operating_cost_per_hour: "0",

  meter_type: "",
  current_meter_reading: "0",
  meter_unit: "",
  last_meter_updated_at: "",
  lifetime_hours: "0",
  lifetime_miles: "0",

  maintenance_status: "current",
  last_service_date: "",
  next_service_date: "",
  last_service_meter: "",
  next_service_meter: "",
  service_interval_days: "",
  service_interval_meter: "",
  maintenance_notes: "",

  registration_expiration_date: "",
  inspection_expiration_date: "",
  insurance_expiration_date: "",
  certification_expiration_date: "",
  requires_operator_certification: false,
  required_certification_type: "",
  safety_notes: "",

  default_cost_code_id: "",
  default_unit_of_measure: "",
  default_quantity: "1",
  taxable: false,

  criticality_level: "standard",
  utilization_target_percent: "",
  replacement_priority: "normal",
  replacement_score: "",
  condition_score: "",
  reliability_score: "",
  ai_notes: "",

  notes: "",
};

export type EquipmentListItem = {
  id: string;
  equipmentNumber: string;
  name: string;
  equipmentType: EquipmentType | null;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  modelYear: number | null;
  serialNumber: string | null;
  ownershipType: OwnershipType;
  currentLocationType: CurrentLocationType | null;
  currentLocationName: string | null;
  assignedJobId: string | null;
  assignedEmployeeId: string | null;
  assignedCrewId: string | null;
  assignedAt: string | null;
  expectedReturnDate: string | null;
  effectiveInternalHourlyCost: number;
  hourlyBillableRate: number;
  maintenanceStatus: MaintenanceStatus;
  status: EquipmentStatus;
  nextServiceDate: string | null;
  lastServiceDate: string | null;
  inspectionExpirationDate: string | null;
  warrantyExpirationDate: string | null;
  registrationExpirationDate: string | null;
  insuranceExpirationDate: string | null;
  certificationExpirationDate: string | null;
  qrCode: string | null;
  purchaseDate: string | null;
  purchasePrice: number;
  currentValue: number;
  meterType: MeterType | null;
  currentMeterReading: number;
  lifetimeHours: number;
  lifetimeMiles: number;
  utilizationTargetPercent: number | null;
  conditionScore: number | null;
  fuelType: string | null;
  maintenanceNotes: string | null;
  notes: string | null;
  defaultCostCodeId: string | null;
  defaultCostCodeLabel: string | null;
  vendorId: string | null;
  vendorName: string | null;
  criticalityLevel: CriticalityLevel;
  replacementPriority: ReplacementPriority;
  createdAt: string;
  updatedAt: string;
};

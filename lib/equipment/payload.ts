import type { Database } from "@/types/database.types";
import type { EquipmentCalculationSummary } from "./validation";
import {
  coerceCriticalityLevel,
  coerceCurrentLocationType,
  coerceDepreciationMethod,
  coerceEquipmentStatus,
  coerceEquipmentType,
  coerceMaintenanceStatus,
  coerceMeterType,
  coerceOwnershipType,
  coerceReplacementPriority,
  type EquipmentFormInput,
  type EquipmentListItem,
  type EquipmentRow,
} from "./types";

export type EquipmentInsertPayload = Database["public"]["Tables"]["equipment"]["Insert"];
export type EquipmentUpdatePayload = Database["public"]["Tables"]["equipment"]["Update"];

export type EquipmentWriteContext = {
  companyId: string;
  userId: string;
};

export type EquipmentWriteCalculations = Pick<
  EquipmentCalculationSummary,
  "effectiveInternalHourlyCost" | "maintenanceDueStatus" | "totalOperatingCostPerHour"
>;

export type EquipmentDisplayLabels = {
  defaultCostCodeLabel?: string | null;
  vendorName?: string | null;
};

function normalizeText(value: string) {
  return value.trim() || null;
}

function parseNumber(value: string) {
  return Number(value);
}

function parseNullableNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function formatDateTimeLocalInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMilliseconds = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
}

function parseDateTimeLocalInput(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function equipmentRowToFormInput(row: EquipmentRow): EquipmentFormInput {
  return {
    equipment_number: row.equipment_number,
    name: row.name,
    description: row.description ?? "",
    status: coerceEquipmentStatus(row.status),
    equipment_type: coerceEquipmentType(row.equipment_type) ?? "",
    category: row.category ?? "",
    subcategory: row.subcategory ?? "",

    manufacturer: row.manufacturer ?? "",
    model: row.model ?? "",
    model_year: row.model_year !== null ? String(row.model_year) : "",
    serial_number: row.serial_number ?? "",
    vin: row.vin ?? "",
    license_plate: row.license_plate ?? "",
    asset_tag: row.asset_tag ?? "",
    barcode: row.barcode ?? "",
    qr_code: row.qr_code ?? "",

    ownership_type: coerceOwnershipType(row.ownership_type),
    vendor_id: row.vendor_id ?? "",
    owner_name: row.owner_name ?? "",
    lease_start_date: row.lease_start_date ?? "",
    lease_end_date: row.lease_end_date ?? "",
    rental_start_date: row.rental_start_date ?? "",
    rental_end_date: row.rental_end_date ?? "",
    rental_agreement_number: row.rental_agreement_number ?? "",

    current_location_type: coerceCurrentLocationType(row.current_location_type) ?? "",
    current_location_name: row.current_location_name ?? "",
    assigned_job_id: row.assigned_job_id ?? "",
    assigned_employee_id: row.assigned_employee_id ?? "",
    assigned_crew_id: row.assigned_crew_id ?? "",
    assigned_at: formatDateTimeLocalInput(row.assigned_at),
    expected_return_date: row.expected_return_date ?? "",

    purchase_date: row.purchase_date ?? "",
    purchase_price: String(row.purchase_price),
    current_value: String(row.current_value),
    salvage_value: String(row.salvage_value),
    financed_amount: String(row.financed_amount),
    monthly_payment: String(row.monthly_payment),
    lease_monthly_cost: String(row.lease_monthly_cost),
    rental_daily_cost: String(row.rental_daily_cost),
    rental_weekly_cost: String(row.rental_weekly_cost),
    rental_monthly_cost: String(row.rental_monthly_cost),
    depreciation_method: coerceDepreciationMethod(row.depreciation_method) ?? "",
    useful_life_years: row.useful_life_years !== null ? String(row.useful_life_years) : "",
    depreciation_start_date: row.depreciation_start_date ?? "",
    warranty_expiration_date: row.warranty_expiration_date ?? "",

    hourly_internal_cost: String(row.hourly_internal_cost),
    hourly_billable_rate: String(row.hourly_billable_rate),
    daily_internal_cost: String(row.daily_internal_cost),
    daily_billable_rate: String(row.daily_billable_rate),
    fuel_type: row.fuel_type ?? "",
    estimated_fuel_cost_per_hour: String(row.estimated_fuel_cost_per_hour),
    maintenance_cost_per_hour: String(row.maintenance_cost_per_hour),
    insurance_cost_per_hour: String(row.insurance_cost_per_hour),
    other_operating_cost_per_hour: String(row.other_operating_cost_per_hour),

    meter_type: coerceMeterType(row.meter_type) ?? "",
    current_meter_reading: String(row.current_meter_reading),
    meter_unit: row.meter_unit ?? "",
    last_meter_updated_at: formatDateTimeLocalInput(row.last_meter_updated_at),
    lifetime_hours: String(row.lifetime_hours),
    lifetime_miles: String(row.lifetime_miles),

    maintenance_status: coerceMaintenanceStatus(row.maintenance_status),
    last_service_date: row.last_service_date ?? "",
    next_service_date: row.next_service_date ?? "",
    last_service_meter: row.last_service_meter !== null ? String(row.last_service_meter) : "",
    next_service_meter: row.next_service_meter !== null ? String(row.next_service_meter) : "",
    service_interval_days: row.service_interval_days !== null ? String(row.service_interval_days) : "",
    service_interval_meter: row.service_interval_meter !== null ? String(row.service_interval_meter) : "",
    maintenance_notes: row.maintenance_notes ?? "",

    registration_expiration_date: row.registration_expiration_date ?? "",
    inspection_expiration_date: row.inspection_expiration_date ?? "",
    insurance_expiration_date: row.insurance_expiration_date ?? "",
    certification_expiration_date: row.certification_expiration_date ?? "",
    requires_operator_certification: row.requires_operator_certification,
    required_certification_type: row.required_certification_type ?? "",
    safety_notes: row.safety_notes ?? "",

    default_cost_code_id: row.default_cost_code_id ?? "",
    default_unit_of_measure: row.default_unit_of_measure ?? "",
    default_quantity: String(row.default_quantity),
    taxable: row.taxable,

    criticality_level: coerceCriticalityLevel(row.criticality_level),
    utilization_target_percent: row.utilization_target_percent !== null ? String(row.utilization_target_percent) : "",
    replacement_priority: coerceReplacementPriority(row.replacement_priority),
    replacement_score: row.replacement_score !== null ? String(row.replacement_score) : "",
    condition_score: row.condition_score !== null ? String(row.condition_score) : "",
    reliability_score: row.reliability_score !== null ? String(row.reliability_score) : "",
    ai_notes: row.ai_notes ?? "",

    notes: row.notes ?? "",
  };
}

export function equipmentRowToListItem(row: Pick<EquipmentRow, "id" | "equipment_number" | "name" | "equipment_type" | "category" | "manufacturer" | "model" | "model_year" | "serial_number" | "ownership_type" | "current_location_type" | "current_location_name" | "assigned_job_id" | "assigned_employee_id" | "assigned_crew_id" | "assigned_at" | "expected_return_date" | "effective_internal_hourly_cost" | "hourly_billable_rate" | "maintenance_status" | "status" | "last_service_date" | "next_service_date" | "inspection_expiration_date" | "warranty_expiration_date" | "registration_expiration_date" | "insurance_expiration_date" | "certification_expiration_date" | "qr_code" | "purchase_date" | "purchase_price" | "current_value" | "meter_type" | "current_meter_reading" | "lifetime_hours" | "lifetime_miles" | "utilization_target_percent" | "condition_score" | "fuel_type" | "maintenance_notes" | "notes" | "default_cost_code_id" | "vendor_id" | "criticality_level" | "replacement_priority" | "created_at" | "updated_at">, labels: EquipmentDisplayLabels = {}): EquipmentListItem {
  return {
    id: row.id,
    equipmentNumber: row.equipment_number,
    name: row.name,
    equipmentType: coerceEquipmentType(row.equipment_type),
    category: row.category,
    manufacturer: row.manufacturer,
    model: row.model,
    modelYear: row.model_year,
    serialNumber: row.serial_number,
    ownershipType: coerceOwnershipType(row.ownership_type),
    currentLocationType: coerceCurrentLocationType(row.current_location_type),
    currentLocationName: row.current_location_name,
    assignedJobId: row.assigned_job_id,
    assignedEmployeeId: row.assigned_employee_id,
    assignedCrewId: row.assigned_crew_id,
    assignedAt: row.assigned_at,
    expectedReturnDate: row.expected_return_date,
    effectiveInternalHourlyCost: row.effective_internal_hourly_cost,
    hourlyBillableRate: row.hourly_billable_rate,
    maintenanceStatus: coerceMaintenanceStatus(row.maintenance_status),
    status: coerceEquipmentStatus(row.status),
    lastServiceDate: row.last_service_date,
    nextServiceDate: row.next_service_date,
    inspectionExpirationDate: row.inspection_expiration_date,
    warrantyExpirationDate: row.warranty_expiration_date,
    registrationExpirationDate: row.registration_expiration_date,
    insuranceExpirationDate: row.insurance_expiration_date,
    certificationExpirationDate: row.certification_expiration_date,
    qrCode: row.qr_code,
    purchaseDate: row.purchase_date,
    purchasePrice: row.purchase_price,
    currentValue: row.current_value,
    meterType: coerceMeterType(row.meter_type),
    currentMeterReading: row.current_meter_reading,
    lifetimeHours: row.lifetime_hours,
    lifetimeMiles: row.lifetime_miles,
    utilizationTargetPercent: row.utilization_target_percent,
    conditionScore: row.condition_score,
    fuelType: row.fuel_type,
    maintenanceNotes: row.maintenance_notes,
    notes: row.notes,
    defaultCostCodeId: row.default_cost_code_id,
    defaultCostCodeLabel: labels.defaultCostCodeLabel ?? null,
    vendorId: row.vendor_id,
    vendorName: labels.vendorName ?? null,
    criticalityLevel: coerceCriticalityLevel(row.criticality_level),
    replacementPriority: coerceReplacementPriority(row.replacement_priority),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildEquipmentBasePayload(
  form: EquipmentFormInput,
  context: EquipmentWriteContext,
  calculations: EquipmentWriteCalculations,
): Omit<EquipmentInsertPayload, "created_by" | "updated_by"> {
  return {
    company_id: context.companyId,
    equipment_number: form.equipment_number.trim(),
    name: form.name.trim(),
    description: normalizeText(form.description),
    status: coerceEquipmentStatus(form.status),
    equipment_type: coerceEquipmentType(form.equipment_type),
    category: normalizeText(form.category),
    subcategory: normalizeText(form.subcategory),

    manufacturer: normalizeText(form.manufacturer),
    model: normalizeText(form.model),
    model_year: form.model_year.trim() ? Number(form.model_year) : null,
    serial_number: normalizeText(form.serial_number),
    vin: normalizeText(form.vin),
    license_plate: normalizeText(form.license_plate),
    asset_tag: normalizeText(form.asset_tag),
    barcode: normalizeText(form.barcode),
    qr_code: normalizeText(form.qr_code),

    ownership_type: coerceOwnershipType(form.ownership_type),
    vendor_id: form.vendor_id.trim() || null,
    owner_name: normalizeText(form.owner_name),
    lease_start_date: form.lease_start_date || null,
    lease_end_date: form.lease_end_date || null,
    rental_start_date: form.rental_start_date || null,
    rental_end_date: form.rental_end_date || null,
    rental_agreement_number: normalizeText(form.rental_agreement_number),

    current_location_type: coerceCurrentLocationType(form.current_location_type),
    current_location_name: normalizeText(form.current_location_name),
    assigned_job_id: form.assigned_job_id.trim() || null,
    assigned_employee_id: form.assigned_employee_id.trim() || null,
    assigned_crew_id: form.assigned_crew_id.trim() || null,
    assigned_at: parseDateTimeLocalInput(form.assigned_at),
    expected_return_date: form.expected_return_date || null,

    purchase_date: form.purchase_date || null,
    purchase_price: parseNumber(form.purchase_price),
    current_value: parseNumber(form.current_value),
    salvage_value: parseNumber(form.salvage_value),
    financed_amount: parseNumber(form.financed_amount),
    monthly_payment: parseNumber(form.monthly_payment),
    lease_monthly_cost: parseNumber(form.lease_monthly_cost),
    rental_daily_cost: parseNumber(form.rental_daily_cost),
    rental_weekly_cost: parseNumber(form.rental_weekly_cost),
    rental_monthly_cost: parseNumber(form.rental_monthly_cost),
    depreciation_method: coerceDepreciationMethod(form.depreciation_method),
    useful_life_years: parseNullableNumber(form.useful_life_years),
    depreciation_start_date: form.depreciation_start_date || null,
    warranty_expiration_date: form.warranty_expiration_date || null,

    hourly_internal_cost: parseNumber(form.hourly_internal_cost),
    hourly_billable_rate: parseNumber(form.hourly_billable_rate),
    daily_internal_cost: parseNumber(form.daily_internal_cost),
    daily_billable_rate: parseNumber(form.daily_billable_rate),
    fuel_type: normalizeText(form.fuel_type),
    estimated_fuel_cost_per_hour: parseNumber(form.estimated_fuel_cost_per_hour),
    maintenance_cost_per_hour: parseNumber(form.maintenance_cost_per_hour),
    insurance_cost_per_hour: parseNumber(form.insurance_cost_per_hour),
    other_operating_cost_per_hour: parseNumber(form.other_operating_cost_per_hour),
    total_operating_cost_per_hour: calculations.totalOperatingCostPerHour,
    effective_internal_hourly_cost: calculations.effectiveInternalHourlyCost,

    meter_type: coerceMeterType(form.meter_type),
    current_meter_reading: parseNumber(form.current_meter_reading),
    meter_unit: normalizeText(form.meter_unit),
    last_meter_updated_at: parseDateTimeLocalInput(form.last_meter_updated_at),
    lifetime_hours: parseNumber(form.lifetime_hours),
    lifetime_miles: parseNumber(form.lifetime_miles),

    maintenance_status: calculations.maintenanceDueStatus,
    last_service_date: form.last_service_date || null,
    next_service_date: form.next_service_date || null,
    last_service_meter: parseNullableNumber(form.last_service_meter),
    next_service_meter: parseNullableNumber(form.next_service_meter),
    service_interval_days: parseNullableNumber(form.service_interval_days),
    service_interval_meter: parseNullableNumber(form.service_interval_meter),
    maintenance_notes: normalizeText(form.maintenance_notes),

    registration_expiration_date: form.registration_expiration_date || null,
    inspection_expiration_date: form.inspection_expiration_date || null,
    insurance_expiration_date: form.insurance_expiration_date || null,
    certification_expiration_date: form.certification_expiration_date || null,
    requires_operator_certification: form.requires_operator_certification,
    required_certification_type: normalizeText(form.required_certification_type),
    safety_notes: normalizeText(form.safety_notes),

    default_cost_code_id: form.default_cost_code_id.trim() || null,
    default_unit_of_measure: normalizeText(form.default_unit_of_measure),
    default_quantity: parseNumber(form.default_quantity),
    taxable: form.taxable,

    criticality_level: coerceCriticalityLevel(form.criticality_level),
    utilization_target_percent: parseNullableNumber(form.utilization_target_percent),
    replacement_priority: coerceReplacementPriority(form.replacement_priority),
    replacement_score: parseNullableNumber(form.replacement_score),
    condition_score: parseNullableNumber(form.condition_score),
    reliability_score: parseNullableNumber(form.reliability_score),
    ai_notes: normalizeText(form.ai_notes),

    notes: normalizeText(form.notes),
  };
}

export function buildEquipmentInsertPayload(
  form: EquipmentFormInput,
  context: EquipmentWriteContext,
  calculations: EquipmentWriteCalculations,
): EquipmentInsertPayload {
  return {
    ...buildEquipmentBasePayload(form, context, calculations),
    created_by: context.userId,
    updated_by: context.userId,
  };
}

export function buildEquipmentUpdatePayload(
  form: EquipmentFormInput,
  context: EquipmentWriteContext,
  calculations: EquipmentWriteCalculations,
): EquipmentUpdatePayload {
  return {
    ...buildEquipmentBasePayload(form, context, calculations),
    updated_by: context.userId,
  };
}

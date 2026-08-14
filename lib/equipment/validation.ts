import {
  CURRENT_LOCATION_TYPES,
  CRITICALITY_LEVELS,
  DEPRECIATION_METHODS,
  EQUIPMENT_STATUSES,
  EQUIPMENT_TYPES,
  METER_TYPES,
  OWNERSHIP_TYPES,
  MAINTENANCE_STATUSES,
  REPLACEMENT_PRIORITIES,
  type EquipmentFormInput,
  type MaintenanceStatus,
} from "./types";

export type EquipmentCalculationSummary = {
  totalOperatingCostPerHour: number;
  effectiveInternalHourlyCost: number;
  hourlyGrossMargin: number;
  hourlyMarginPercentage: number;
  straightLineAnnualDepreciation: number;
  straightLineMonthlyDepreciation: number;
  estimatedCurrentBookValue: number;
  maintenanceDueStatus: MaintenanceStatus;
  warrantyStatus: string;
  registrationStatus: string;
  inspectionStatus: string;
  insuranceStatus: string;
  certificationStatus: string;
};

export type EquipmentValidationResult = {
  isValid: boolean;
  errors: string[];
  calculations: EquipmentCalculationSummary;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundTo(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundMoney(value: number) {
  return roundTo(value, 4);
}

export function formatPercent(value: number) {
  return `${roundTo(value, 2).toFixed(2)}%`;
}

function isNonNegativeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function isIntegerInRange(value: string, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

function isPercentInRange(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
}

function isScoreInRange(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
}

function asDate(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidStatus(value: string) {
  return EQUIPMENT_STATUSES.includes(value as (typeof EQUIPMENT_STATUSES)[number]);
}

export function formatUsdCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function calculateTotalOperatingCostPerHour(input: EquipmentFormInput) {
  const total = parseNumber(input.estimated_fuel_cost_per_hour)
    + parseNumber(input.maintenance_cost_per_hour)
    + parseNumber(input.insurance_cost_per_hour)
    + parseNumber(input.other_operating_cost_per_hour);

  return roundMoney(total);
}

export function calculateEffectiveInternalHourlyCost(input: EquipmentFormInput, totalOperatingCostPerHour: number) {
  return roundMoney(parseNumber(input.hourly_internal_cost) + totalOperatingCostPerHour);
}

export function calculateHourlyGrossMargin(input: EquipmentFormInput, effectiveInternalHourlyCost: number) {
  return roundMoney(parseNumber(input.hourly_billable_rate) - effectiveInternalHourlyCost);
}

export function calculateHourlyMarginPercentage(input: EquipmentFormInput, hourlyGrossMargin: number) {
  const billableRate = parseNumber(input.hourly_billable_rate);

  if (billableRate <= 0) {
    return 0;
  }

  return roundTo((hourlyGrossMargin / billableRate) * 100, 4);
}

export function calculateStraightLineAnnualDepreciation(purchasePrice: number, salvageValue: number, usefulLifeYears: number) {
  if (usefulLifeYears <= 0) {
    return 0;
  }

  return roundMoney(Math.max(purchasePrice - salvageValue, 0) / usefulLifeYears);
}

export function calculateStraightLineMonthlyDepreciation(annualDepreciation: number) {
  return roundMoney(annualDepreciation / 12);
}

export function calculateEstimatedCurrentBookValue(
  purchasePrice: number,
  salvageValue: number,
  depreciationStartDate: string,
  usefulLifeYears: number,
  method: string,
  currentDate = new Date(),
) {
  if (method !== "straight_line" || usefulLifeYears <= 0) {
    return roundMoney(purchasePrice);
  }

  const startDate = asDate(depreciationStartDate);

  if (!startDate) {
    return roundMoney(purchasePrice);
  }

  const annualDepreciation = calculateStraightLineAnnualDepreciation(purchasePrice, salvageValue, usefulLifeYears);
  const elapsedYears = Math.max((currentDate.getTime() - startDate.getTime()) / (365.25 * DAY_MS), 0);
  const depreciated = annualDepreciation * elapsedYears;

  return roundMoney(Math.max(purchasePrice - depreciated, salvageValue));
}

export function evaluateMaintenanceDueStatus(input: EquipmentFormInput, currentDate = new Date()): MaintenanceStatus {
  if (input.maintenance_status === "unavailable") {
    return "unavailable";
  }

  if (input.maintenance_status === "in_service") {
    return "in_service";
  }

  const nextServiceDate = asDate(input.next_service_date);
  const currentMeterReading = parseNumber(input.current_meter_reading);
  const nextServiceMeter = input.next_service_meter.trim() ? parseNumber(input.next_service_meter) : null;

  const dateDueSoon = nextServiceDate
    ? Math.ceil((nextServiceDate.getTime() - currentDate.getTime()) / DAY_MS) <= 30
    : false;

  const dateOverdue = nextServiceDate ? nextServiceDate.getTime() < currentDate.getTime() : false;

  const meterDueSoon = nextServiceMeter !== null
    ? currentMeterReading >= nextServiceMeter || currentMeterReading >= nextServiceMeter * 0.9
    : false;

  const meterOverdue = nextServiceMeter !== null ? currentMeterReading >= nextServiceMeter : false;

  if (dateOverdue || meterOverdue) {
    return "overdue";
  }

  if (dateDueSoon || meterDueSoon) {
    return "due_soon";
  }

  if (input.maintenance_status === "not_required") {
    return "not_required";
  }

  return "current";
}

export function evaluateDateStatus(expirationDate: string, currentDate = new Date()) {
  const date = asDate(expirationDate);

  if (!date) {
    return "not_required";
  }

  const daysUntil = Math.ceil((date.getTime() - currentDate.getTime()) / DAY_MS);

  if (daysUntil < 0) {
    return "overdue";
  }

  if (daysUntil <= 30) {
    return "due_soon";
  }

  return "current";
}

export function calculateEquipmentSummary(input: EquipmentFormInput, currentDate = new Date()) {
  const totalOperatingCostPerHour = calculateTotalOperatingCostPerHour(input);
  const effectiveInternalHourlyCost = calculateEffectiveInternalHourlyCost(input, totalOperatingCostPerHour);
  const hourlyGrossMargin = calculateHourlyGrossMargin(input, effectiveInternalHourlyCost);
  const hourlyMarginPercentage = calculateHourlyMarginPercentage(input, hourlyGrossMargin);
  const purchasePrice = parseNumber(input.purchase_price);
  const salvageValue = parseNumber(input.salvage_value);
  const usefulLifeYears = parseNumber(input.useful_life_years);
  const annualDepreciation = input.depreciation_method === "straight_line"
    ? calculateStraightLineAnnualDepreciation(purchasePrice, salvageValue, usefulLifeYears)
    : 0;
  const monthlyDepreciation = calculateStraightLineMonthlyDepreciation(annualDepreciation);
  const estimatedCurrentBookValue = calculateEstimatedCurrentBookValue(
    purchasePrice,
    salvageValue,
    input.depreciation_start_date,
    usefulLifeYears,
    input.depreciation_method,
    currentDate,
  );

  return {
    totalOperatingCostPerHour,
    effectiveInternalHourlyCost,
    hourlyGrossMargin,
    hourlyMarginPercentage,
    straightLineAnnualDepreciation: annualDepreciation,
    straightLineMonthlyDepreciation: monthlyDepreciation,
    estimatedCurrentBookValue,
    maintenanceDueStatus: evaluateMaintenanceDueStatus(input, currentDate),
    warrantyStatus: evaluateDateStatus(input.warranty_expiration_date, currentDate),
    registrationStatus: evaluateDateStatus(input.registration_expiration_date, currentDate),
    inspectionStatus: evaluateDateStatus(input.inspection_expiration_date, currentDate),
    insuranceStatus: evaluateDateStatus(input.insurance_expiration_date, currentDate),
    certificationStatus: evaluateDateStatus(input.certification_expiration_date, currentDate),
  };
}

export function validateEquipmentInput(input: EquipmentFormInput, options?: { allowedVendorIds?: string[]; allowedCostCodeIds?: string[] }) {
  const errors: string[] = [];
  const calculations = calculateEquipmentSummary(input);

  if (!input.equipment_number.trim()) {
    errors.push("Equipment number is required.");
  }

  if (!input.name.trim()) {
    errors.push("Equipment name is required.");
  }

  if (!isValidStatus(input.status)) {
    errors.push("Status is invalid.");
  }

  if (!OWNERSHIP_TYPES.includes(input.ownership_type)) {
    errors.push("Ownership type is invalid.");
  }

  if (input.equipment_type && !EQUIPMENT_TYPES.includes(input.equipment_type)) {
    errors.push("Equipment type is invalid.");
  }

  if (input.current_location_type && !CURRENT_LOCATION_TYPES.includes(input.current_location_type)) {
    errors.push("Current location type is invalid.");
  }

  if (input.meter_type && !METER_TYPES.includes(input.meter_type)) {
    errors.push("Meter type is invalid.");
  }

  if (input.depreciation_method && !DEPRECIATION_METHODS.includes(input.depreciation_method)) {
    errors.push("Depreciation method is invalid.");
  }

  if (!CRITICALITY_LEVELS.includes(input.criticality_level)) {
    errors.push("Criticality level is invalid.");
  }

  if (!REPLACEMENT_PRIORITIES.includes(input.replacement_priority)) {
    errors.push("Replacement priority is invalid.");
  }

  if (!isNonNegativeNumber(input.purchase_price)) {
    errors.push("Purchase price must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.current_value)) {
    errors.push("Current value must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.salvage_value)) {
    errors.push("Salvage value must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.financed_amount)) {
    errors.push("Financed amount must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.monthly_payment)) {
    errors.push("Monthly payment must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.lease_monthly_cost)) {
    errors.push("Lease monthly cost must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.rental_daily_cost)) {
    errors.push("Rental daily cost must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.rental_weekly_cost)) {
    errors.push("Rental weekly cost must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.rental_monthly_cost)) {
    errors.push("Rental monthly cost must be a non-negative number.");
  }

  if (!input.vendor_id.trim() && input.ownership_type !== "owned" && input.ownership_type !== "employee_owned") {
    // vendor is optional but commonly required for leased/rented/subcontractor equipment.
  }

  const moneyFields: Array<[string, string]> = [
    ["Base internal hourly cost", input.hourly_internal_cost],
    ["Hourly billable rate", input.hourly_billable_rate],
    ["Daily internal cost", input.daily_internal_cost],
    ["Daily billable rate", input.daily_billable_rate],
    ["Estimated fuel cost per hour", input.estimated_fuel_cost_per_hour],
    ["Maintenance cost per hour", input.maintenance_cost_per_hour],
    ["Insurance cost per hour", input.insurance_cost_per_hour],
    ["Other operating cost per hour", input.other_operating_cost_per_hour],
    ["Current meter reading", input.current_meter_reading],
    ["Lifetime hours", input.lifetime_hours],
    ["Lifetime miles", input.lifetime_miles],
    ["Default quantity", input.default_quantity],
  ];

  for (const [label, value] of moneyFields) {
    if (!isNonNegativeNumber(value)) {
      errors.push(`${label} must be a non-negative number.`);
    }
  }

  const multiplierFields: Array<[string, string, number, number]> = [
    ["Base hourly cost rate", input.hourly_internal_cost, 0, Number.POSITIVE_INFINITY],
    ["Utilization target", input.utilization_target_percent, 0, 100],
  ];

  for (const [label, value, min, max] of multiplierFields) {
    if (value.trim() && (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max)) {
      errors.push(`${label} is invalid.`);
    }
  }

  const percentFields = [
    ["Utilization target percent", input.utilization_target_percent],
  ] as const;

  for (const [label, value] of percentFields) {
    if (value.trim() && !isPercentInRange(value)) {
      errors.push(`${label} must be between 0 and 100.`);
    }
  }

  const scoreFields = [
    ["Replacement score", input.replacement_score],
    ["Condition score", input.condition_score],
    ["Reliability score", input.reliability_score],
  ] as const;

  for (const [label, value] of scoreFields) {
    if (value.trim() && !isScoreInRange(value)) {
      errors.push(`${label} must be between 0 and 100.`);
    }
  }

  if (input.model_year.trim() && !isIntegerInRange(input.model_year, 1900, new Date().getFullYear() + 1)) {
    errors.push("Model year must be a reasonable year.");
  }

  if (input.useful_life_years.trim() && !isNonNegativeNumber(input.useful_life_years)) {
    errors.push("Useful life years must be a non-negative number.");
  }

  if (input.lease_start_date && input.lease_end_date && asDate(input.lease_end_date) && asDate(input.lease_start_date) && asDate(input.lease_end_date)!.getTime() < asDate(input.lease_start_date)!.getTime()) {
    errors.push("Lease end date cannot be before lease start date.");
  }

  if (input.rental_start_date && input.rental_end_date && asDate(input.rental_end_date) && asDate(input.rental_start_date) && asDate(input.rental_end_date)!.getTime() < asDate(input.rental_start_date)!.getTime()) {
    errors.push("Rental end date cannot be before rental start date.");
  }

  if (input.depreciation_start_date && input.purchase_date && asDate(input.depreciation_start_date) && asDate(input.purchase_date) && asDate(input.depreciation_start_date)!.getTime() < asDate(input.purchase_date)!.getTime()) {
    errors.push("Depreciation start date cannot be before purchase date.");
  }

  if (input.last_service_date && input.next_service_date && asDate(input.next_service_date) && asDate(input.last_service_date) && asDate(input.next_service_date)!.getTime() < asDate(input.last_service_date)!.getTime()) {
    errors.push("Next service date cannot be before last service date.");
  }

  if (input.warranty_expiration_date && input.purchase_date && asDate(input.warranty_expiration_date) && asDate(input.purchase_date) && asDate(input.warranty_expiration_date)!.getTime() < asDate(input.purchase_date)!.getTime()) {
    errors.push("Warranty expiration date cannot be before purchase date.");
  }

  if (input.registration_expiration_date && input.purchase_date && asDate(input.registration_expiration_date) && asDate(input.purchase_date) && asDate(input.registration_expiration_date)!.getTime() < asDate(input.purchase_date)!.getTime()) {
    errors.push("Registration expiration date cannot be before purchase date.");
  }

  if (input.inspection_expiration_date && input.purchase_date && asDate(input.inspection_expiration_date) && asDate(input.purchase_date) && asDate(input.inspection_expiration_date)!.getTime() < asDate(input.purchase_date)!.getTime()) {
    errors.push("Inspection expiration date cannot be before purchase date.");
  }

  if (input.insurance_expiration_date && input.purchase_date && asDate(input.insurance_expiration_date) && asDate(input.purchase_date) && asDate(input.insurance_expiration_date)!.getTime() < asDate(input.purchase_date)!.getTime()) {
    errors.push("Insurance expiration date cannot be before purchase date.");
  }

  if (input.certification_expiration_date && input.purchase_date && asDate(input.certification_expiration_date) && asDate(input.purchase_date) && asDate(input.certification_expiration_date)!.getTime() < asDate(input.purchase_date)!.getTime()) {
    errors.push("Certification expiration date cannot be before purchase date.");
  }

  if (input.requires_operator_certification && !input.required_certification_type.trim()) {
    errors.push("Required certification type is required when operator certification is enabled.");
  }

  if (input.vendor_id.trim() && options?.allowedVendorIds && !options.allowedVendorIds.includes(input.vendor_id)) {
    errors.push("Vendor must belong to your company.");
  }

  if (input.default_cost_code_id.trim() && options?.allowedCostCodeIds && !options.allowedCostCodeIds.includes(input.default_cost_code_id)) {
    errors.push("Default cost code must belong to your company.");
  }

  const validMaintenance = MAINTENANCE_STATUSES.includes(input.maintenance_status);
  if (!validMaintenance) {
    errors.push("Maintenance status is invalid.");
  }

  const maintenanceStatus = calculateEquipmentSummary(input).maintenanceDueStatus;

  return {
    isValid: errors.length === 0,
    errors,
    calculations: {
      ...calculations,
      maintenanceDueStatus: maintenanceStatus,
    },
  };
}

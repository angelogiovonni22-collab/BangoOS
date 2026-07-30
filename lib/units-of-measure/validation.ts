import {
  UNIT_CATEGORIES,
  UNIT_MEASUREMENT_SYSTEMS,
  UNIT_TYPES,
  type UnitCategory,
  type UnitFormValues,
  type UnitMeasurementSystem,
  type UnitOfMeasureRow,
} from "./types";

export type UnitValidationOptions = {
  currentUnitId?: string;
  companyId: string;
  availableBaseUnits: UnitOfMeasureRow[];
  existingUnit?: UnitOfMeasureRow | null;
};

export type UnitValidationResult = {
  isValid: boolean;
  errors: string[];
  normalizedCode: string;
};

function isInSet<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return allowed.includes(value);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeUnitCode(code: string) {
  return code.trim().toUpperCase();
}

export function isCompatibleMeasurementSystem(
  unitSystem: UnitMeasurementSystem,
  baseSystem: UnitMeasurementSystem,
) {
  return unitSystem === baseSystem || unitSystem === "universal" || baseSystem === "universal";
}

export function validateUnitFormValues(
  values: UnitFormValues,
  options: UnitValidationOptions,
): UnitValidationResult {
  const errors: string[] = [];

  const normalizedCode = normalizeUnitCode(values.code);
  const normalizedName = values.name.trim();
  const normalizedCategory = values.category;
  const normalizedMeasurementSystem = values.measurement_system;
  const normalizedUnitType = values.unit_type;

  if (!normalizedCode) {
    errors.push("Code is required.");
  }

  if (!normalizedName) {
    errors.push("Name is required.");
  }

  if (!isInSet(normalizedCategory, UNIT_CATEGORIES)) {
    errors.push("Category is invalid.");
  }

  if (!isInSet(normalizedMeasurementSystem, UNIT_MEASUREMENT_SYSTEMS)) {
    errors.push("Measurement system is invalid.");
  }

  if (!isInSet(normalizedUnitType, UNIT_TYPES)) {
    errors.push("Unit type is invalid.");
  }

  const decimalPrecision = toNumber(values.decimal_precision);

  if (decimalPrecision === null || !Number.isInteger(decimalPrecision) || decimalPrecision < 0 || decimalPrecision > 8) {
    errors.push("Decimal precision must be a whole number between 0 and 8.");
  }

  const sortOrder = toNumber(values.sort_order);

  if (sortOrder === null || !Number.isInteger(sortOrder) || sortOrder < 0) {
    errors.push("Sort order must be a whole number greater than or equal to 0.");
  }

  const conversionFactor = values.conversion_factor.trim() ? toNumber(values.conversion_factor) : null;

  if (values.conversion_factor.trim() && (conversionFactor === null || conversionFactor <= 0)) {
    errors.push("Conversion factor must be greater than 0 when provided.");
  }

  if (values.base_unit_id && !values.conversion_factor.trim()) {
    errors.push("Conversion factor is required when a base unit is selected.");
  }

  if (!values.base_unit_id && values.conversion_factor.trim()) {
    errors.push("Select a base unit when a conversion factor is provided.");
  }

  const baseUnit = values.base_unit_id
    ? options.availableBaseUnits.find((unit) => unit.id === values.base_unit_id) || null
    : null;

  if (values.base_unit_id && !baseUnit) {
    errors.push("Selected base unit is not available in your workspace.");
  }

  if (values.base_unit_id && options.currentUnitId && values.base_unit_id === options.currentUnitId) {
    errors.push("A unit cannot reference itself as a base unit.");
  }

  if (baseUnit) {
    if ((baseUnit.company_id ?? null) !== null && baseUnit.company_id !== options.companyId) {
      errors.push("Base unit must be a system unit or belong to your company.");
    }

    if ((baseUnit.category as UnitCategory) !== values.category) {
      errors.push("Base unit category must match this unit category.");
    }

    if (!isCompatibleMeasurementSystem(values.measurement_system, baseUnit.measurement_system as UnitMeasurementSystem)) {
      errors.push("Base unit measurement system is incompatible.");
    }

    if (options.currentUnitId && baseUnit.base_unit_id === options.currentUnitId) {
      errors.push("Circular base-unit reference is not allowed.");
    }
  }

  if (options.existingUnit?.is_system) {
    errors.push("System units cannot be edited through company forms.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedCode,
  };
}

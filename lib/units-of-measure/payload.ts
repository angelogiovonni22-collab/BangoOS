import type { UnitFormValues, UnitOfMeasureInsert, UnitOfMeasureUpdate } from "./types";
import { normalizeUnitCode } from "./validation";

type PayloadContext = {
  companyId: string;
  userId: string;
};

function trimToNull(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function parseRequiredInteger(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseNullableNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildBasePayload(values: UnitFormValues, context: PayloadContext): Omit<UnitOfMeasureInsert, "created_by" | "updated_by"> {
  return {
    company_id: context.companyId,
    code: normalizeUnitCode(values.code),
    name: values.name.trim(),
    plural_name: trimToNull(values.plural_name),
    symbol: trimToNull(values.symbol),
    description: trimToNull(values.description),
    category: values.category,
    measurement_system: values.measurement_system,
    unit_type: values.unit_type,
    base_unit_id: values.base_unit_id || null,
    conversion_factor: parseNullableNumber(values.conversion_factor),
    decimal_precision: parseRequiredInteger(values.decimal_precision, 2),
    allow_fractional_quantity: values.allow_fractional_quantity,
    is_system: false,
    is_active: values.is_active,
    sort_order: parseRequiredInteger(values.sort_order, 0),
    notes: trimToNull(values.notes),
  };
}

export function buildUnitInsertPayload(values: UnitFormValues, context: PayloadContext): UnitOfMeasureInsert {
  return {
    ...buildBasePayload(values, context),
    created_by: context.userId,
    updated_by: context.userId,
  };
}

export function buildUnitUpdatePayload(values: UnitFormValues, context: PayloadContext): UnitOfMeasureUpdate {
  return {
    ...buildBasePayload(values, context),
    updated_by: context.userId,
  };
}

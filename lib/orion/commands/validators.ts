import type { OrionCommandValidationResult } from "./types";
import {
  mapOrionCustomerCreateParamsToInput,
  mapOrionCustomerUpdateParamsToInput,
  validateCustomerCreateInput,
  validateCustomerUpdateInput,
} from "@/lib/customers";

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string, errors: string[]) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${key} is required.`);
    return null;
  }

  return value.trim();
}

export function validateObject(params: unknown): OrionCommandValidationResult {
  const record = asRecord(params);
  if (!record) {
    return {
      ok: false,
      errors: ["Command parameters must be an object."],
    };
  }

  return {
    ok: true,
    errors: [],
    normalizedParams: record,
  };
}

export function validateRequiredKeys(params: unknown, keys: string[]): OrionCommandValidationResult {
  const objectValidation = validateObject(params);
  if (!objectValidation.ok || !objectValidation.normalizedParams) {
    return objectValidation;
  }

  const normalized = objectValidation.normalizedParams;
  const errors: string[] = [];

  for (const key of keys) {
    requiredString(normalized, key, errors);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    errors: [],
    normalizedParams: normalized,
  };
}

export function validateOptionalStringArray(params: unknown, key: string): string[] {
  const record = asRecord(params);
  if (!record) {
    return [];
  }

  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function validateScheduleReadRangeParams(params: unknown): OrionCommandValidationResult {
  const objectValidation = validateObject(params);
  if (!objectValidation.ok || !objectValidation.normalizedParams) {
    return objectValidation;
  }

  const normalized = objectValidation.normalizedParams;
  const errors: string[] = [];
  const rangeType = requiredString(normalized, "rangeType", errors);
  const rangeKey = requiredString(normalized, "rangeKey", errors);
  const timezone = normalized.timezone;

  if (rangeType && rangeType !== "day" && rangeType !== "week") {
    errors.push("rangeType must be 'day' or 'week'.");
  }

  if (rangeType === "day" && rangeKey && rangeKey !== "today" && rangeKey !== "tomorrow") {
    errors.push("rangeKey must be 'today' or 'tomorrow' when rangeType is 'day'.");
  }

  if (rangeType === "week" && rangeKey && rangeKey !== "this_week") {
    errors.push("rangeKey must be 'this_week' when rangeType is 'week'.");
  }

  if (timezone !== undefined && timezone !== null && typeof timezone !== "string") {
    errors.push("timezone must be a string when provided.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    errors: [],
    normalizedParams: {
      rangeType,
      rangeKey,
      timezone: typeof timezone === "string" && timezone.trim() ? timezone.trim() : null,
    },
  };
}

export function validateCustomerCreateParams(params: unknown): OrionCommandValidationResult {
  const objectValidation = validateObject(params);
  if (!objectValidation.ok || !objectValidation.normalizedParams) {
    return objectValidation;
  }

  const normalized = objectValidation.normalizedParams;
  const validation = validateCustomerCreateInput(mapOrionCustomerCreateParamsToInput(normalized));

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
    };
  }

  return {
    ok: true,
    errors: [],
    normalizedParams: normalized,
  };
}

export function validateCustomerUpdateParams(params: unknown): OrionCommandValidationResult {
  const objectValidation = validateObject(params);
  if (!objectValidation.ok || !objectValidation.normalizedParams) {
    return objectValidation;
  }

  const normalized = objectValidation.normalizedParams;
  const customerId = normalized.customerId;

  if (typeof customerId !== "string" || customerId.trim().length === 0) {
    return {
      ok: false,
      errors: ["customerId is required."],
    };
  }

  const validation = validateCustomerUpdateInput(mapOrionCustomerUpdateParamsToInput(normalized));
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
    };
  }

  return {
    ok: true,
    errors: [],
    normalizedParams: normalized,
  };
}

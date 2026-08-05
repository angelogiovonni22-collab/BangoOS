import type { OrionCommandValidationResult } from "./types";

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

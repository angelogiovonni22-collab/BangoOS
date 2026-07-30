import type { CostCodeFormInput, CostCodeStatus } from "./types";

export type CostCodeValidationResult = {
  isValid: boolean;
  errors: string[];
};

function isValidStatus(value: string): value is CostCodeStatus {
  return ["active", "inactive", "archived"].includes(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isNonNegativeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

export function validateCostCodeInput(input: CostCodeFormInput): CostCodeValidationResult {
  const errors: string[] = [];

  if (!input.code.trim()) {
    errors.push("Cost code is required.");
  }

  if (!input.name.trim()) {
    errors.push("Cost code name is required.");
  }

  if (!isValidStatus(input.status)) {
    errors.push("Status is invalid.");
  }

  if (input.parent_cost_code_id.trim() && !isUuid(input.parent_cost_code_id.trim())) {
    errors.push("Parent cost code must be a valid UUID.");
  }

  if (input.default_labor_rate_id.trim() && !isUuid(input.default_labor_rate_id.trim())) {
    errors.push("Default labor rate id must be a valid UUID.");
  }

  if (input.default_material_category_id.trim() && !isUuid(input.default_material_category_id.trim())) {
    errors.push("Default material category id must be a valid UUID.");
  }

  if (input.default_equipment_category_id.trim() && !isUuid(input.default_equipment_category_id.trim())) {
    errors.push("Default equipment category id must be a valid UUID.");
  }

  if (!isNonNegativeNumber(input.budget)) {
    errors.push("Budget must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.committed_cost)) {
    errors.push("Committed cost must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.actual_cost)) {
    errors.push("Actual cost must be a non-negative number.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

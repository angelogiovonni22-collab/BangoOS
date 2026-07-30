import type { MaterialFormInput, MaterialStatus } from "./types";

export type MaterialValidationResult = {
  isValid: boolean;
  errors: string[];
};

function isValidStatus(value: string): value is MaterialStatus {
  return ["active", "inactive", "discontinued", "archived"].includes(value);
}

function isNonNegativeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function isNonNegativeInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
}

export function validateMaterialInput(input: MaterialFormInput): MaterialValidationResult {
  const errors: string[] = [];

  if (!input.material_code.trim()) {
    errors.push("Material code is required.");
  }

  if (!input.name.trim()) {
    errors.push("Material name is required.");
  }

  if (!input.unit_of_measure.trim()) {
    errors.push("Unit of measure is required.");
  }

  if (!isValidStatus(input.status)) {
    errors.push("Status is invalid.");
  }

  if (!isNonNegativeNumber(input.standard_cost)) {
    errors.push("Standard cost must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.average_cost)) {
    errors.push("Average cost must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.last_purchase_cost)) {
    errors.push("Last purchase cost must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.markup_percent)) {
    errors.push("Markup percent must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.suggested_sell_price)) {
    errors.push("Suggested sell price must be a non-negative number.");
  }

  if (input.lead_time_days.trim() && !isNonNegativeInteger(input.lead_time_days)) {
    errors.push("Lead time days must be a non-negative whole number.");
  }

  if (!isNonNegativeNumber(input.current_stock)) {
    errors.push("Current stock must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.reorder_point)) {
    errors.push("Reorder point must be a non-negative number.");
  }

  if (!isNonNegativeNumber(input.reorder_quantity)) {
    errors.push("Reorder quantity must be a non-negative number.");
  }

  if (input.weight.trim() && !isNonNegativeNumber(input.weight)) {
    errors.push("Weight must be a non-negative number.");
  }

  if (input.width.trim() && !isNonNegativeNumber(input.width)) {
    errors.push("Width must be a non-negative number.");
  }

  if (input.height.trim() && !isNonNegativeNumber(input.height)) {
    errors.push("Height must be a non-negative number.");
  }

  if (input.length.trim() && !isNonNegativeNumber(input.length)) {
    errors.push("Length must be a non-negative number.");
  }

  if (input.last_purchase_date.trim()) {
    const parsedDate = new Date(input.last_purchase_date);

    if (Number.isNaN(parsedDate.getTime())) {
      errors.push("Last purchase date is invalid.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

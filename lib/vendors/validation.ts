import type { VendorFormInput, VendorStatus } from "./types";

export type VendorValidationResult = {
  isValid: boolean;
  errors: string[];
};

function isValidStatus(value: string): value is VendorStatus {
  return ["active", "inactive", "probation", "suspended", "archived"].includes(value);
}

function isNumericInRange(value: string, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

export function validateVendorInput(input: VendorFormInput): VendorValidationResult {
  const errors: string[] = [];

  if (!input.vendor_code.trim()) {
    errors.push("Vendor code is required.");
  }

  if (!input.company_name.trim()) {
    errors.push("Company legal name is required.");
  }

  if (!input.display_name.trim()) {
    errors.push("Display name is required.");
  }

  if (!isValidStatus(input.status)) {
    errors.push("Status is invalid.");
  }

  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.push("Primary contact email is invalid.");
  }

  if (input.website.trim()) {
    try {
      new URL(input.website.trim());
    } catch {
      errors.push("Website must be a valid URL.");
    }
  }

  if (input.credit_limit.trim()) {
    const creditLimit = Number(input.credit_limit);

    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      errors.push("Credit limit must be a non-negative number.");
    }
  }

  if (input.quality_rating.trim() && !isNumericInRange(input.quality_rating, 0, 5)) {
    errors.push("Quality rating must be between 0 and 5.");
  }

  if (input.delivery_rating.trim() && !isNumericInRange(input.delivery_rating, 0, 5)) {
    errors.push("Delivery rating must be between 0 and 5.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

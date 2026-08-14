export type CustomerCreateInput = {
  customerType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  companyName?: string | null;
  addressLine2?: string | null;
  notes?: string | null;
};

export const CUSTOMER_CREATE_REQUIRED_FIELDS: Array<keyof CustomerCreateInput> = [
  "customerType",
  "firstName",
  "lastName",
  "email",
  "phone",
  "addressLine1",
  "city",
  "state",
  "postalCode",
];

export type CustomerCreateValidationResult =
  | {
      ok: true;
      errors: [];
      normalized: CustomerCreateInput;
    }
  | {
      ok: false;
      errors: string[];
      normalized: CustomerCreateInput;
    };

function clean(value: string | null | undefined) {
  return (value || "").trim();
}

function normalizeCustomerType(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "commercial") {
    return "commercial";
  }

  if (normalized === "residential") {
    return "residential";
  }

  return "residential";
}

export function normalizeCustomerCreateInput(input: CustomerCreateInput): CustomerCreateInput {
  return {
    customerType: normalizeCustomerType(input.customerType),
    firstName: clean(input.firstName),
    lastName: clean(input.lastName),
    email: clean(input.email),
    phone: clean(input.phone),
    addressLine1: clean(input.addressLine1),
    city: clean(input.city),
    state: clean(input.state),
    postalCode: clean(input.postalCode),
    companyName: clean(input.companyName),
    addressLine2: clean(input.addressLine2),
    notes: clean(input.notes),
  };
}

export function validateCustomerCreateInput(input: CustomerCreateInput): CustomerCreateValidationResult {
  const normalized = normalizeCustomerCreateInput(input);
  const errors: string[] = [];

  for (const field of CUSTOMER_CREATE_REQUIRED_FIELDS) {
    const value = normalized[field];
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`${field} is required.`);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      normalized,
    };
  }

  return {
    ok: true,
    errors: [],
    normalized,
  };
}

export function mapOrionCustomerCreateParamsToInput(params: Record<string, unknown>): CustomerCreateInput {
  const text = (value: unknown) => (typeof value === "string" ? value : "");

  return {
    customerType: text(params.customerType) || "residential",
    firstName: text(params.firstName),
    lastName: text(params.lastName),
    email: text(params.email),
    phone: text(params.phone),
    addressLine1: text(params.addressLine1),
    city: text(params.city),
    state: text(params.state),
    postalCode: text(params.postalCode),
    companyName: text(params.companyName),
    addressLine2: text(params.addressLine2),
    notes: text(params.notes),
  };
}

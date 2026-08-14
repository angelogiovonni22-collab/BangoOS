import {
  normalizeCustomerCreateInput,
  validateCustomerCreateInput,
  type CustomerCreateInput,
} from "./customer-create-contract";

export type CustomerUpdateInput = CustomerCreateInput;

export type CustomerUpdateValidationResult = ReturnType<typeof validateCustomerUpdateInput>;

export function normalizeCustomerUpdateInput(input: CustomerUpdateInput): CustomerUpdateInput {
  return normalizeCustomerCreateInput(input);
}

export function validateCustomerUpdateInput(input: CustomerUpdateInput) {
  return validateCustomerCreateInput(input);
}

export function mapOrionCustomerUpdateParamsToInput(params: Record<string, unknown>): CustomerUpdateInput {
  const source = params.updates && typeof params.updates === "object" && !Array.isArray(params.updates)
    ? params.updates as Record<string, unknown>
    : params;

  const text = (value: unknown) => (typeof value === "string" ? value : "");

  return {
    customerType: text(source.customerType) || text(source.customer_type) || "residential",
    firstName: text(source.firstName) || text(source.first_name),
    lastName: text(source.lastName) || text(source.last_name),
    email: text(source.email),
    phone: text(source.phone) || text(source.phoneNumber),
    addressLine1: text(source.addressLine1) || text(source.address_line_1),
    city: text(source.city),
    state: text(source.state),
    postalCode: text(source.postalCode) || text(source.postal_code),
    companyName: text(source.companyName) || text(source.company_name),
    addressLine2: text(source.addressLine2) || text(source.address_line_2),
    notes: text(source.notes),
  };
}

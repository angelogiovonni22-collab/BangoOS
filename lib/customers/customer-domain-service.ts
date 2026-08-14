import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import type { OrionCommandPermission } from "@/lib/orion/commands";
import type { Database } from "@/types/database.types";
import { normalizeCustomerCreateInput } from "./customer-create-contract";
import { normalizeCustomerUpdateInput, validateCustomerUpdateInput, type CustomerUpdateInput } from "./customer-update-contract";

const CUSTOMER_WRITE_ALLOWED_ROLES: OrionCommandPermission[] = [
  "owner",
  "administrator",
  "operations_manager",
  "project_manager",
  "superintendent",
];

const CUSTOMER_ARCHIVE_ALLOWED_ROLES: OrionCommandPermission[] = ["owner", "administrator"];

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

type CustomerEventPublisher = {
  publishEvent: (event: Record<string, unknown>) => Promise<string>;
};

type CustomerDomainBaseParams = {
  supabase: SupabaseClient<Database>;
  companyId: string;
  actorProfileId: string;
  role: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  eventPublisher?: CustomerEventPublisher;
};

export class CustomerDomainError extends Error {
  readonly code: "VALIDATION" | "PERMISSION" | "NOT_FOUND" | "PERSISTENCE";
  readonly details: Record<string, unknown>;

  constructor(code: CustomerDomainError["code"], message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "CustomerDomainError";
    this.code = code;
    this.details = details;
  }
}

export type CustomerDomainResult = {
  customerId: string;
  deepLink: string;
  status: "active" | "archived";
  normalized: CustomerUpdateInput;
};

function normalizeRole(role: string | null | undefined): OrionCommandPermission {
  const value = (role || "employee").trim().toLowerCase();
  if (value === "owner") return "owner";
  if (value === "admin" || value === "administrator") return "administrator";
  if (value === "operations_manager") return "operations_manager";
  if (value === "project_manager") return "project_manager";
  if (value === "superintendent") return "superintendent";
  if (value === "accountant") return "accountant";
  return "employee";
}

function isAllowed(role: string | null | undefined, allowedRoles: OrionCommandPermission[]) {
  return allowedRoles.includes(normalizeRole(role));
}

function customerSelectColumns() {
  return "id, company_id, customer_type, first_name, last_name, company_name, email, phone, address_line_1, address_line_2, city, state, postal_code, notes, status, created_at, updated_at, created_by";
}

async function loadCustomer(supabase: SupabaseClient<Database>, companyId: string, customerId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select(customerSelectColumns())
    .eq("company_id", companyId)
    .eq("id", customerId)
    .maybeSingle<CustomerRow>();

  if (error) {
    throw new CustomerDomainError("PERSISTENCE", error.message || "Unable to load customer.");
  }

  return data || null;
}

function publishEventPublisher(params: CustomerDomainBaseParams) {
  return params.eventPublisher ?? createSupabaseOrionEventPublisher(params.supabase);
}

function buildDeepLink(customerId: string) {
  return `/customers/${customerId}`;
}

export async function updateCustomer(params: CustomerDomainBaseParams & {
  customerId: string;
  input: CustomerUpdateInput;
}): Promise<CustomerDomainResult> {
  const validation = validateCustomerUpdateInput(params.input);
  if (!validation.ok) {
    throw new CustomerDomainError("VALIDATION", validation.errors.join(" "), {
      validationErrors: validation.errors,
    });
  }

  if (!isAllowed(params.role, CUSTOMER_WRITE_ALLOWED_ROLES)) {
    throw new CustomerDomainError("PERMISSION", "You do not have permission to update customers.");
  }

  const normalized = normalizeCustomerUpdateInput(normalizeCustomerCreateInput(validation.normalized));
  const current = await loadCustomer(params.supabase, params.companyId, params.customerId);

  if (!current) {
    throw new CustomerDomainError("NOT_FOUND", "Customer not found.");
  }

  const updatedAt = new Date().toISOString();
  const { error } = await params.supabase
    .from("customers")
    .update({
      customer_type: normalized.customerType,
      first_name: normalized.firstName,
      last_name: normalized.lastName,
      company_name: normalized.companyName || null,
      email: normalized.email,
      phone: normalized.phone,
      address_line_1: normalized.addressLine1,
      address_line_2: normalized.addressLine2 || null,
      city: normalized.city,
      state: normalized.state,
      postal_code: normalized.postalCode,
      notes: normalized.notes || null,
      updated_at: updatedAt,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.customerId);

  if (error) {
    throw new CustomerDomainError("PERSISTENCE", error.message || "Unable to update customer.");
  }

  const deepLink = buildDeepLink(params.customerId);
  const publisher = publishEventPublisher(params);
  await publisher.publishEvent({
    company_id: params.companyId,
    actor_profile_id: params.actorProfileId,
    event_type: "customer.updated",
    aggregate_type: "customer",
    aggregate_id: params.customerId,
    source_module: "customers",
    correlation_id: params.correlationId || null,
    idempotency_key: params.idempotencyKey ? `${params.idempotencyKey}:customer-updated` : undefined,
    payload: {
      customer_id: params.customerId,
      customer_type: normalized.customerType,
      customer_name: `${normalized.firstName} ${normalized.lastName}`.trim(),
      company_name: normalized.companyName || null,
      email: normalized.email,
      status: current.status,
      deep_link: deepLink,
    },
    metadata: {
      event_category: "customers",
      event_severity: "info",
      deep_link: deepLink,
    },
  });

  return {
    customerId: params.customerId,
    deepLink,
    status: current.status === "archived" ? "archived" : "active",
    normalized,
  };
}

async function changeCustomerStatus(
  params: CustomerDomainBaseParams & { customerId: string; nextStatus: "active" | "archived"; eventType: "customer.archived" | "customer.restored" },
): Promise<CustomerDomainResult> {
  if (!isAllowed(params.role, CUSTOMER_ARCHIVE_ALLOWED_ROLES)) {
    throw new CustomerDomainError("PERMISSION", "You do not have permission to archive customers.");
  }

  const current = await loadCustomer(params.supabase, params.companyId, params.customerId);
  if (!current) {
    throw new CustomerDomainError("NOT_FOUND", "Customer not found.");
  }

  const { error } = await params.supabase
    .from("customers")
    .update({
      status: params.nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", params.companyId)
    .eq("id", params.customerId);

  if (error) {
    throw new CustomerDomainError("PERSISTENCE", error.message || "Unable to update customer status.");
  }

  const deepLink = buildDeepLink(params.customerId);
  const publisher = publishEventPublisher(params);
  await publisher.publishEvent({
    company_id: params.companyId,
    actor_profile_id: params.actorProfileId,
    event_type: params.eventType,
    aggregate_type: "customer",
    aggregate_id: params.customerId,
    source_module: "customers",
    correlation_id: params.correlationId || null,
    idempotency_key: params.idempotencyKey ? `${params.idempotencyKey}:${params.eventType}` : undefined,
    payload: {
      customer_id: params.customerId,
      status: params.nextStatus,
      deep_link: deepLink,
    },
    metadata: {
      event_category: "customers",
      event_severity: params.nextStatus === "archived" ? "attention" : "success",
      deep_link: deepLink,
    },
  });

  return {
    customerId: params.customerId,
    deepLink,
    status: params.nextStatus,
    normalized: normalizeCustomerUpdateInput({
      customerType: current.customer_type,
      firstName: current.first_name || "",
      lastName: current.last_name || "",
      email: current.email || "",
      phone: current.phone || "",
      addressLine1: current.address_line_1 || "",
      addressLine2: current.address_line_2 || "",
      city: current.city || "",
      state: current.state || "",
      postalCode: current.postal_code || "",
      companyName: current.company_name || "",
      notes: current.notes || "",
    }),
  };
}

export async function archiveCustomer(params: CustomerDomainBaseParams & { customerId: string }): Promise<CustomerDomainResult> {
  return changeCustomerStatus({ ...params, nextStatus: "archived", eventType: "customer.archived" });
}

export async function restoreCustomer(params: CustomerDomainBaseParams & { customerId: string }): Promise<CustomerDomainResult> {
  return changeCustomerStatus({ ...params, nextStatus: "active", eventType: "customer.restored" });
}

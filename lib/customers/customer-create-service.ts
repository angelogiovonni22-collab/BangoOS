import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import type { OrionCommandPermission } from "@/lib/orion/commands";
import type { Database } from "@/types/database.types";
import { normalizeCustomerCreateInput, type CustomerCreateInput, validateCustomerCreateInput } from "./customer-create-contract";

const CUSTOMER_CREATE_ALLOWED_ROLES: OrionCommandPermission[] = [
  "owner",
  "administrator",
  "operations_manager",
  "project_manager",
  "superintendent",
];

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

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeName(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeLikeToken(value: string) {
  return value.replace(/[%_,]/g, "").trim();
}

type CustomerDuplicateCandidate = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
};

export class CustomerCreateError extends Error {
  readonly code: "VALIDATION" | "PERMISSION" | "DUPLICATE" | "PERSISTENCE";
  readonly details: Record<string, unknown>;

  constructor(code: CustomerCreateError["code"], message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "CustomerCreateError";
    this.code = code;
    this.details = details;
  }
}

export type CustomerCreateResult = {
  customerId: string;
  deepLink: string;
  duplicateCandidates: Array<{ id: string; label: string }>;
  idempotencyKey: string | null;
  normalized: CustomerCreateInput;
};

async function findStrongDuplicateCandidates(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  normalized: CustomerCreateInput;
}) {
  const normalizedEmail = params.normalized.email.toLowerCase();
  const normalizedPhone = normalizeDigits(params.normalized.phone);
  const normalizedCompany = normalizeName(params.normalized.companyName);
  const normalizedFirst = normalizeName(params.normalized.firstName);
  const normalizedLast = normalizeName(params.normalized.lastName);

  const clauses: string[] = [];

  if (normalizedEmail) {
    clauses.push(`email.ilike.${escapeLikeToken(normalizedEmail)}`);
  }

  if (normalizedPhone.length >= 7) {
    clauses.push(`phone.ilike.%${normalizedPhone.slice(-7)}%`);
  }

  if (normalizedCompany) {
    clauses.push(`company_name.ilike.${escapeLikeToken(normalizedCompany)}`);
  }

  if (normalizedFirst) {
    clauses.push(`first_name.ilike.${escapeLikeToken(normalizedFirst)}`);
  }

  if (normalizedLast) {
    clauses.push(`last_name.ilike.${escapeLikeToken(normalizedLast)}`);
  }

  if (clauses.length === 0) {
    return [] as CustomerDuplicateCandidate[];
  }

  const { data, error } = await params.supabase
    .from("customers")
    .select("id, first_name, last_name, company_name, email, phone")
    .eq("company_id", params.companyId)
    .or(clauses.join(","))
    .limit(8);

  if (error) {
    throw new CustomerCreateError("PERSISTENCE", error.message || "Unable to check duplicate customers.");
  }

  return (data || []) as CustomerDuplicateCandidate[];
}

function isStrongDuplicate(candidate: CustomerDuplicateCandidate, normalized: CustomerCreateInput) {
  const emailMatch = normalized.email
    && (candidate.email || "").trim().toLowerCase() === normalized.email.toLowerCase();

  const phoneDigits = normalizeDigits(normalized.phone);
  const candidatePhoneDigits = normalizeDigits(candidate.phone || "");
  const phoneMatch = phoneDigits.length >= 7 && candidatePhoneDigits === phoneDigits;

  const companyMatch = normalizeName(candidate.company_name) && normalizeName(candidate.company_name) === normalizeName(normalized.companyName);
  const contactMatch = normalizeName(candidate.first_name) === normalizeName(normalized.firstName)
    && normalizeName(candidate.last_name) === normalizeName(normalized.lastName);

  return Boolean(emailMatch || phoneMatch || companyMatch || contactMatch);
}

function candidateLabel(candidate: CustomerDuplicateCandidate) {
  const company = (candidate.company_name || "").trim();
  const contact = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim();
  return company || contact || candidate.id;
}

export async function createCustomer(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  actorProfileId: string;
  role: string | null;
  input: CustomerCreateInput;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  duplicateMode?: "allow" | "block_strong";
}) : Promise<CustomerCreateResult> {
  const validation = validateCustomerCreateInput(params.input);
  if (!validation.ok) {
    throw new CustomerCreateError("VALIDATION", validation.errors.join(" "), {
      validationErrors: validation.errors,
    });
  }

  const normalizedRole = normalizeRole(params.role);
  if (!CUSTOMER_CREATE_ALLOWED_ROLES.includes(normalizedRole)) {
    throw new CustomerCreateError("PERMISSION", "You do not have permission to create customers.");
  }

  const normalized = normalizeCustomerCreateInput(validation.normalized);
  const duplicateCandidates = await findStrongDuplicateCandidates({
    supabase: params.supabase,
    companyId: params.companyId,
    normalized,
  });

  const strongMatches = duplicateCandidates.filter((candidate) => isStrongDuplicate(candidate, normalized));

  if ((params.duplicateMode || "allow") === "block_strong" && strongMatches.length > 0) {
    throw new CustomerCreateError("DUPLICATE", "A strong duplicate customer already exists.", {
      duplicateCandidates: strongMatches.map((candidate) => ({
        id: candidate.id,
        label: candidateLabel(candidate),
      })),
    });
  }

  const { data, error } = await params.supabase
    .from("customers")
    .insert({
      company_id: params.companyId,
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
      created_by: params.actorProfileId,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new CustomerCreateError("PERSISTENCE", error?.message || "Unable to create customer.");
  }

  const orion = createSupabaseOrionEventPublisher(params.supabase);
  const deepLink = `/customers/${data.id}`;
  await orion.publishEvent({
    company_id: params.companyId,
    actor_profile_id: params.actorProfileId,
    event_type: "customer.created",
    aggregate_type: "customer",
    aggregate_id: data.id,
    source_module: "customers",
    correlation_id: params.correlationId || null,
    idempotency_key: params.idempotencyKey ? `${params.idempotencyKey}:customer-created` : undefined,
    payload: {
      customer_id: data.id,
      customer_type: normalized.customerType,
      first_name: normalized.firstName,
      last_name: normalized.lastName,
      customer_name: `${normalized.firstName} ${normalized.lastName}`.trim(),
      company_name: normalized.companyName || null,
      email: normalized.email,
      deep_link: deepLink,
    },
    metadata: {
      event_category: "customers",
      event_severity: "info",
      deep_link: deepLink,
    },
  });

  return {
    customerId: data.id,
    deepLink,
    idempotencyKey: params.idempotencyKey || null,
    normalized,
    duplicateCandidates: strongMatches.map((candidate) => ({
      id: candidate.id,
      label: candidateLabel(candidate),
    })),
  };
}

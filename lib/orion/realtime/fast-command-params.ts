import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrionEntity, type OrionResolvableEntityType } from "@/lib/orion/realtime/entity-resolution";
import type { Database } from "@/types/database.types";

type ParamsRecord = Record<string, unknown>;

type FastCommandParamsResult = {
  params: ParamsRecord;
  error: string | null;
  resolvedAliases: Array<{ field: string; entityType: OrionResolvableEntityType; label: string; id: string }>;
};

const ESTIMATE_STATUSES = new Set(["draft", "internal_review", "sent", "viewed", "approved", "rejected", "expired", "archived", "ready", "revision_requested", "void", "superseded"]);
const ESTIMATE_CATEGORIES = new Set(["labor", "materials", "equipment", "subcontractors", "general_conditions", "permits_fees", "other"]);
const ESTIMATE_UNITS = new Set(["each", "hour", "day", "week", "square_foot", "linear_foot", "cubic_yard", "lump_sum"]);
const INVOICE_STATUSES = new Set(["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void"]);
const INVOICE_UNITS = ESTIMATE_UNITS;
const DISCOUNT_TYPES = new Set(["none", "percentage", "fixed"]);

function record(value: unknown): ParamsRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as ParamsRecord) } : {};
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numericText(value: unknown, fallback = "0") {
  const raw = text(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? String(parsed) : fallback;
}

function enumText(value: unknown, allowed: Set<string>, fallback: string) {
  const normalized = text(value).toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function compactTitle(source: string, fallback: string) {
  const normalized = source.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length <= 72 ? normalized : `${normalized.slice(0, 69).trimEnd()}...`;
}

function normalizeEstimateLineItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const item = record(entry);
    return {
      id: text(item.id) || `orion-estimate-line-${index + 1}`,
      sortOrder: typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder) ? item.sortOrder : index + 1,
      itemCode: text(item.itemCode),
      category: enumText(item.category, ESTIMATE_CATEGORIES, "other"),
      description: text(item.description),
      quantity: numericText(item.quantity, "1"),
      unit: enumText(item.unit, ESTIMATE_UNITS, "each"),
      unitCost: numericText(item.unitCost ?? item.rate ?? item.price, "0"),
      markupPercent: numericText(item.markupPercent ?? item.markup, "0"),
      notes: text(item.notes),
    };
  });
}

function normalizeInvoiceLineItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const item = record(entry);
    return {
      id: text(item.id) || `orion-invoice-line-${index + 1}`,
      sortOrder: typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder) ? item.sortOrder : index + 1,
      description: text(item.description),
      quantity: numericText(item.quantity, "1"),
      unit: enumText(item.unit, INVOICE_UNITS, "each"),
      rate: numericText(item.rate ?? item.unitCost ?? item.price, "0"),
      notes: text(item.notes),
    };
  });
}

async function resolveAlias(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  entityType: OrionResolvableEntityType;
  phrase: string;
  field: string;
}) {
  const resolution = await resolveOrionEntity({
    supabase: params.supabase,
    companyId: params.companyId,
    entityType: params.entityType,
    phrase: params.phrase,
  });

  if (resolution.resolved) {
    return {
      id: resolution.resolved.id,
      label: resolution.resolved.label,
      error: null,
    } as const;
  }

  if (resolution.candidates.length) {
    const choices = resolution.candidates.map((candidate) => candidate.label).join(", ");
    return {
      id: null,
      label: null,
      error: `I found more than one possible ${params.entityType} for ${params.phrase}: ${choices}. Please be more specific.`,
    } as const;
  }

  return {
    id: null,
    label: null,
    error: `I couldn't find a matching ${params.entityType} for ${params.phrase}.`,
  } as const;
}

async function enrichNamedReferences(args: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  commandId: string;
  params: ParamsRecord;
}) {
  const next = { ...args.params };
  const aliases: FastCommandParamsResult["resolvedAliases"] = [];

  const resolveInto = async (target: ParamsRecord, idField: string, nameField: string, entityType: OrionResolvableEntityType) => {
    if (text(target[idField]) || !text(target[nameField])) return null;
    const resolved = await resolveAlias({
      supabase: args.supabase,
      companyId: args.companyId,
      entityType,
      phrase: text(target[nameField]),
      field: idField,
    });
    if (resolved.error) return resolved.error;
    target[idField] = resolved.id;
    aliases.push({ field: idField, entityType, label: resolved.label || text(target[nameField]), id: resolved.id || "" });
    return null;
  };

  if (args.commandId === "project.create") {
    const error = await resolveInto(next, "customerId", "customerName", "customer");
    return { params: next, aliases, error };
  }

  if (args.commandId === "estimate.create") {
    const values = record(next.values);
    next.values = values;
    let error = await resolveInto(values, "customerId", "customerName", "customer");
    if (!error) error = await resolveInto(values, "projectId", "projectName", "project");
    return { params: next, aliases, error };
  }

  if (args.commandId === "invoice.create") {
    const values = record(next.values);
    next.values = values;
    let error = await resolveInto(values, "customerId", "customerName", "customer");
    if (!error) error = await resolveInto(values, "projectId", "projectName", "project");
    if (!error) error = await resolveInto(values, "estimateId", "estimateName", "estimate");
    return { params: next, aliases, error };
  }

  return { params: next, aliases, error: null };
}

function normalizeEstimateCreate(params: ParamsRecord) {
  const next = { ...params };
  const values = record(next.values);
  const description = text(values.description);
  next.values = {
    ...values,
    title: text(values.title) || compactTitle(description, "New Estimate"),
    estimateNumber: text(values.estimateNumber),
    customerId: text(values.customerId),
    projectId: text(values.projectId),
    issueDate: text(values.issueDate) || today(),
    expirationDate: text(values.expirationDate),
    preparedBy: text(values.preparedBy),
    status: enumText(values.status, ESTIMATE_STATUSES, "draft"),
    description,
    discountType: enumText(values.discountType, DISCOUNT_TYPES, "none"),
    discountValue: numericText(values.discountValue, "0"),
    taxRatePercent: numericText(values.taxRatePercent ?? values.taxRate, "0"),
    additionalFee: numericText(values.additionalFee, "0"),
    internalNotes: text(values.internalNotes),
    customerNotes: text(values.customerNotes),
    scopeInclusions: text(values.scopeInclusions) || description,
    scopeExclusions: text(values.scopeExclusions),
    terms: text(values.terms),
    paymentTerms: text(values.paymentTerms),
  };
  next.lineItems = normalizeEstimateLineItems(next.lineItems);
  return next;
}

function normalizeInvoiceCreate(params: ParamsRecord) {
  const next = { ...params };
  const values = record(next.values);
  const description = text(values.description);
  next.values = {
    ...values,
    title: text(values.title) || compactTitle(description, "New Invoice"),
    invoiceNumber: text(values.invoiceNumber),
    customerId: text(values.customerId),
    projectId: text(values.projectId),
    estimateId: text(values.estimateId),
    preparedBy: text(values.preparedBy),
    issueDate: text(values.issueDate) || today(),
    dueDate: text(values.dueDate),
    status: enumText(values.status, INVOICE_STATUSES, "draft"),
    description,
    discountType: enumText(values.discountType, DISCOUNT_TYPES, "none"),
    discountValue: numericText(values.discountValue, "0"),
    taxRatePercent: numericText(values.taxRatePercent ?? values.taxRate, "0"),
    additionalFee: numericText(values.additionalFee, "0"),
    notes: text(values.notes),
    paymentTerms: text(values.paymentTerms),
  };
  next.lineItems = normalizeInvoiceLineItems(next.lineItems);
  return next;
}

function normalizeCustomerCreate(params: ParamsRecord) {
  const next = { ...params };
  next.customerType = enumText(next.customerType, new Set(["residential", "commercial"]), "residential");
  return next;
}

function normalizeProjectCreate(params: ParamsRecord) {
  const next = { ...params };
  if (!text(next.status)) next.status = "lead";
  return next;
}

export async function normalizeRealtimeFastCommandParams(args: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  commandId: string;
  params: ParamsRecord;
}): Promise<FastCommandParamsResult> {
  const enriched = await enrichNamedReferences(args);
  if (enriched.error) {
    return { params: enriched.params, error: enriched.error, resolvedAliases: enriched.aliases };
  }

  let params = enriched.params;
  if (args.commandId === "customer.create") params = normalizeCustomerCreate(params);
  else if (args.commandId === "project.create") params = normalizeProjectCreate(params);
  else if (args.commandId === "estimate.create") params = normalizeEstimateCreate(params);
  else if (args.commandId === "invoice.create") params = normalizeInvoiceCreate(params);

  return { params, error: null, resolvedAliases: enriched.aliases };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateInvoiceTotals, invoiceLineItemMoney } from "@/lib/invoices/calculations";
import { getNextInvoiceNumber } from "@/lib/invoices/numbering";
import { normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import type {
  InvoiceFormValues,
  InvoiceLineItemDraft,
  InvoiceLineItemInsert,
  InvoiceLineItemRow,
  InvoicePaymentRow,
  InvoiceRow,
  InvoiceStatus,
} from "@/lib/invoices/types";
import type { Database } from "@/types/database.types";

type CustomerSummaryRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  | "id"
  | "first_name"
  | "last_name"
  | "company_name"
  | "customer_type"
  | "email"
  | "phone"
  | "address_line_1"
  | "address_line_2"
  | "city"
  | "state"
  | "postal_code"
>;

type ProjectSummaryRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "customer_id"
>;

type ProfileSummaryRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name"
>;

type EstimateSummaryRow = Pick<
  Database["public"]["Tables"]["estimates"]["Row"],
  "id" | "title" | "estimate_number" | "status" | "customer_id" | "project_id" | "total_amount"
>;

export type InvoiceDirectoryRecord = Pick<
  InvoiceRow,
  | "id"
  | "title"
  | "invoice_number"
  | "customer_id"
  | "project_id"
  | "status"
  | "issue_date"
  | "due_date"
  | "total_amount"
  | "amount_paid"
  | "updated_at"
  | "archived_at"
>;

export type InvoiceFormOptions = {
  customers: CustomerSummaryRow[];
  projects: ProjectSummaryRow[];
  profiles: ProfileSummaryRow[];
  estimates: EstimateSummaryRow[];
};

export type InvoiceRecordWithChildren = {
  invoice: InvoiceRow;
  lineItems: InvoiceLineItemRow[];
  payments: InvoicePaymentRow[];
};

export async function loadInvoiceDirectoryData(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const [invoicesResponse, customersResponse, projectsResponse] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, title, invoice_number, customer_id, project_id, status, issue_date, due_date, total_amount, amount_paid, updated_at, archived_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id, first_name, last_name, company_name, customer_type, email, phone, address_line_1, address_line_2, city, state, postal_code")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, customer_id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  if (invoicesResponse.error) {
    return { error: invoicesResponse.error.message };
  }

  if (customersResponse.error) {
    return { error: customersResponse.error.message };
  }

  if (projectsResponse.error) {
    return { error: projectsResponse.error.message };
  }

  return {
    error: null,
    invoices: (invoicesResponse.data ?? []) as InvoiceDirectoryRecord[],
    customers: (customersResponse.data ?? []) as CustomerSummaryRow[],
    projects: (projectsResponse.data ?? []) as ProjectSummaryRow[],
  };
}

export async function loadInvoiceFormOptions(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<{ error: string | null; data: InvoiceFormOptions | null }> {
  const [customersResponse, projectsResponse, profilesResponse, estimatesResponse] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, last_name, company_name, customer_type, email, phone, address_line_1, address_line_2, city, state, postal_code")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, customer_id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("company_id", companyId)
      .order("first_name", { ascending: true }),
    supabase
      .from("estimates")
      .select("id, title, estimate_number, status, customer_id, project_id, total_amount")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  if (customersResponse.error) {
    return { error: customersResponse.error.message, data: null };
  }

  if (projectsResponse.error) {
    return { error: projectsResponse.error.message, data: null };
  }

  if (profilesResponse.error) {
    return { error: profilesResponse.error.message, data: null };
  }

  if (estimatesResponse.error) {
    return { error: estimatesResponse.error.message, data: null };
  }

  return {
    error: null,
    data: {
      customers: (customersResponse.data ?? []) as CustomerSummaryRow[],
      projects: (projectsResponse.data ?? []) as ProjectSummaryRow[],
      profiles: (profilesResponse.data ?? []) as ProfileSummaryRow[],
      estimates: (estimatesResponse.data ?? []) as EstimateSummaryRow[],
    },
  };
}

export async function loadInvoiceById(
  supabase: SupabaseClient<Database>,
  companyId: string,
  invoiceId: string,
): Promise<{ error: string | null; data: InvoiceRecordWithChildren | null }> {
  const [invoiceResponse, lineItemsResponse, paymentsResponse] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", invoiceId)
      .maybeSingle<InvoiceRow>(),
    supabase
      .from("invoice_line_items")
      .select("*")
      .eq("company_id", companyId)
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("invoice_payment_history")
      .select("*")
      .eq("company_id", companyId)
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: false }),
  ]);

  if (invoiceResponse.error) {
    return { error: invoiceResponse.error.message, data: null };
  }

  if (!invoiceResponse.data) {
    return { error: "Invoice not found.", data: null };
  }

  if (lineItemsResponse.error) {
    return { error: lineItemsResponse.error.message, data: null };
  }

  if (paymentsResponse.error) {
    return { error: paymentsResponse.error.message, data: null };
  }

  return {
    error: null,
    data: {
      invoice: invoiceResponse.data,
      lineItems: (lineItemsResponse.data ?? []) as InvoiceLineItemRow[],
      payments: (paymentsResponse.data ?? []) as InvoicePaymentRow[],
    },
  };
}

export function getCustomerDisplayName(customer: CustomerSummaryRow) {
  const companyName = customer.company_name?.trim() || "";
  const firstName = customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");

  if (customer.customer_type?.trim().toLowerCase() === "commercial" && companyName) {
    return companyName;
  }

  return fallbackName || companyName || "Unnamed customer";
}

export function getProjectDisplayName(project: ProjectSummaryRow) {
  return project.name?.trim() || "Unnamed project";
}

export function getProfileDisplayName(profile: ProfileSummaryRow) {
  const name = [profile.first_name?.trim() || "", profile.last_name?.trim() || ""]
    .filter(Boolean)
    .join(" ");

  return name || "Unassigned";
}

function mapLineItemsForInsert(params: {
  companyId: string;
  invoiceId: string;
  lineItems: InvoiceLineItemDraft[];
}) {
  return params.lineItems
    .filter((item) => item.description.trim().length > 0)
    .map((item, index) => {
      const money = invoiceLineItemMoney(item);

      const lineItemRecord: InvoiceLineItemInsert = {
        company_id: params.companyId,
        invoice_id: params.invoiceId,
        sort_order: index,
        description: item.description.trim(),
        quantity: money.quantity,
        unit: item.unit,
        rate: money.rate,
        amount: money.amount,
        notes: item.notes.trim() || null,
      };

      return lineItemRecord;
    });
}

function normalizeForSave(status: string): InvoiceStatus {
  const normalized = normalizeInvoiceStatus(status);

  if (
    normalized === "draft"
    || normalized === "sent"
    || normalized === "viewed"
    || normalized === "partially_paid"
    || normalized === "paid"
    || normalized === "overdue"
    || normalized === "void"
  ) {
    return normalized;
  }

  return "draft";
}

export async function saveInvoice(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  userId: string;
  values: InvoiceFormValues;
  lineItems: InvoiceLineItemDraft[];
  invoiceId?: string;
}) {
  const totals = calculateInvoiceTotals({
    lineItems: params.lineItems,
    discountType: params.values.discountType,
    discountValue: params.values.discountValue,
    taxRatePercent: params.values.taxRatePercent,
    additionalFee: params.values.additionalFee,
  });

  const invoiceNumber = params.values.invoiceNumber.trim()
    || await getNextInvoiceNumber(params.supabase, params.companyId);

  const status = normalizeForSave(params.values.status);

  const invoicePayload: Database["public"]["Tables"]["invoices"]["Insert"] = {
    company_id: params.companyId,
    title: params.values.title.trim(),
    invoice_number: invoiceNumber,
    customer_id: params.values.customerId || null,
    project_id: params.values.projectId || null,
    estimate_id: params.values.estimateId || null,
    prepared_by: params.values.preparedBy || null,
    issue_date: params.values.issueDate || null,
    due_date: params.values.dueDate || null,
    status,
    description: params.values.description.trim() || null,
    subtotal: totals.subtotal,
    discount_type: params.values.discountType,
    discount_value: Number(params.values.discountValue || 0),
    discount_total: totals.discountTotal,
    tax_rate: Number(params.values.taxRatePercent || 0) / 100,
    tax_amount: totals.taxTotal,
    additional_fee: totals.additionalFee,
    total_amount: totals.grandTotal,
    amount_paid: 0,
    notes: params.values.notes.trim() || null,
    payment_terms: params.values.paymentTerms.trim() || null,
    created_by: params.userId,
    updated_by: params.userId,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    paid_date: status === "paid" ? new Date().toISOString().slice(0, 10) : null,
    archived_at: status === "void" ? new Date().toISOString() : null,
  };

  let invoiceId = params.invoiceId;

  if (invoiceId) {
    const { error: updateError } = await params.supabase
      .from("invoices")
      .update({
        ...invoicePayload,
        amount_paid: undefined,
        company_id: undefined,
      })
      .eq("company_id", params.companyId)
      .eq("id", invoiceId);

    if (updateError) {
      return { error: updateError.message, invoiceId: null };
    }
  } else {
    const { data: insertedInvoice, error: insertError } = await params.supabase
      .from("invoices")
      .insert(invoicePayload)
      .select("id")
      .single();

    if (insertError) {
      return { error: insertError.message, invoiceId: null };
    }

    invoiceId = insertedInvoice.id;
  }

  if (!invoiceId) {
    return { error: "Unable to resolve invoice record.", invoiceId: null };
  }

  const { error: deleteItemsError } = await params.supabase
    .from("invoice_line_items")
    .delete()
    .eq("company_id", params.companyId)
    .eq("invoice_id", invoiceId);

  if (deleteItemsError) {
    return { error: deleteItemsError.message, invoiceId: null };
  }

  const nextLineItems = mapLineItemsForInsert({
    companyId: params.companyId,
    invoiceId,
    lineItems: params.lineItems,
  });

  if (nextLineItems.length > 0) {
    const { error: lineItemsError } = await params.supabase
      .from("invoice_line_items")
      .insert(nextLineItems);

    if (lineItemsError) {
      return { error: lineItemsError.message, invoiceId: null };
    }
  }

  if (params.values.estimateId) {
    await params.supabase
      .from("invoice_estimate_links")
      .upsert({
        company_id: params.companyId,
        invoice_id: invoiceId,
        estimate_id: params.values.estimateId,
        link_type: "manual",
        created_by: params.userId,
      }, { onConflict: "invoice_id,estimate_id" });
  }

  return { error: null, invoiceId };
}

export async function sendInvoice(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  invoiceId: string;
  userId: string;
}) {
  const { error } = await params.supabase
    .from("invoices")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      updated_by: params.userId,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.invoiceId);

  return { error: error?.message || null };
}

export async function markInvoicePaid(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  invoiceId: string;
  userId: string;
}) {
  const record = await loadInvoiceById(params.supabase, params.companyId, params.invoiceId);

  if (record.error || !record.data) {
    return { error: record.error || "Invoice not found." };
  }

  const now = new Date().toISOString();

  const { error: paymentError } = await params.supabase
    .from("invoice_payment_history")
    .insert({
      company_id: params.companyId,
      invoice_id: params.invoiceId,
      payment_date: now.slice(0, 10),
      amount: record.data.invoice.total_amount,
      method: "manual",
      status: "recorded",
      notes: "Marked paid from invoice profile.",
      created_by: params.userId,
    });

  if (paymentError) {
    return { error: paymentError.message };
  }

  const { error } = await params.supabase
    .from("invoices")
    .update({
      status: "paid",
      amount_paid: record.data.invoice.total_amount,
      paid_date: now.slice(0, 10),
      updated_by: params.userId,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.invoiceId);

  return { error: error?.message || null };
}

export async function voidInvoice(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  invoiceId: string;
  userId: string;
}) {
  const { error } = await params.supabase
    .from("invoices")
    .update({
      status: "void",
      archived_at: new Date().toISOString(),
      updated_by: params.userId,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.invoiceId);

  return { error: error?.message || null };
}

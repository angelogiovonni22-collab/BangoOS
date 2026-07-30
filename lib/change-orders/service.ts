import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateChangeOrderTotals, changeOrderLineItemMoney } from "@/lib/change-orders/calculations";
import { getNextChangeOrderNumber } from "@/lib/change-orders/numbering";
import { normalizeChangeOrderStatus } from "@/lib/change-orders/statuses";
import type {
  ChangeOrderActivityRow,
  ChangeOrderFormValues,
  ChangeOrderInsert,
  ChangeOrderLineItemDraft,
  ChangeOrderLineItemInsert,
  ChangeOrderLineItemRow,
  ChangeOrderNoteRow,
  ChangeOrderRow,
  ChangeOrderStatus,
} from "@/lib/change-orders/types";
import { saveInvoice } from "@/lib/invoices/service";
import type { InvoiceFormValues } from "@/lib/invoices/types";
import type { Database, Json } from "@/types/database.types";

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
  "id" | "title" | "estimate_number" | "status" | "customer_id" | "project_id"
>;

type InvoiceSummaryRow = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  "id" | "title" | "invoice_number" | "status" | "customer_id" | "project_id" | "total_amount"
>;

type ChangeOrderInvoiceLinkSummary = Pick<
  Database["public"]["Tables"]["change_order_invoice_links"]["Row"],
  "id" | "invoice_id" | "amount_applied" | "link_type" | "created_at"
>;

export type ChangeOrderDirectoryRecord = Pick<
  ChangeOrderRow,
  | "id"
  | "change_order_number"
  | "title"
  | "customer_id"
  | "project_id"
  | "status"
  | "requested_date"
  | "schedule_impact_days"
  | "total_amount"
  | "updated_at"
  | "archived_at"
  | "description"
>;

export type ChangeOrderFormOptions = {
  customers: CustomerSummaryRow[];
  projects: ProjectSummaryRow[];
  profiles: ProfileSummaryRow[];
  estimates: EstimateSummaryRow[];
  invoices: InvoiceSummaryRow[];
};

export type ChangeOrderRecordWithChildren = {
  changeOrder: ChangeOrderRow;
  lineItems: ChangeOrderLineItemRow[];
  notes: ChangeOrderNoteRow[];
  activity: ChangeOrderActivityRow[];
  invoiceLinks: ChangeOrderInvoiceLinkSummary[];
};

const WORKFLOW_STATUSES: ChangeOrderStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "invoiced",
  "void",
];

export async function loadChangeOrderDirectoryData(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const [changeOrdersResponse, customersResponse, projectsResponse] = await Promise.all([
    supabase
      .from("change_orders")
      .select("id, change_order_number, title, customer_id, project_id, status, requested_date, schedule_impact_days, total_amount, updated_at, archived_at, description")
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

  if (changeOrdersResponse.error) {
    return { error: changeOrdersResponse.error.message };
  }

  if (customersResponse.error) {
    return { error: customersResponse.error.message };
  }

  if (projectsResponse.error) {
    return { error: projectsResponse.error.message };
  }

  return {
    error: null,
    changeOrders: (changeOrdersResponse.data ?? []) as ChangeOrderDirectoryRecord[],
    customers: (customersResponse.data ?? []) as CustomerSummaryRow[],
    projects: (projectsResponse.data ?? []) as ProjectSummaryRow[],
  };
}

export async function loadChangeOrderFormOptions(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<{ error: string | null; data: ChangeOrderFormOptions | null }> {
  const [customersResponse, projectsResponse, profilesResponse, estimatesResponse, invoicesResponse] = await Promise.all([
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
      .select("id, title, estimate_number, status, customer_id, project_id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, title, invoice_number, status, customer_id, project_id, total_amount")
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

  if (invoicesResponse.error) {
    return { error: invoicesResponse.error.message, data: null };
  }

  return {
    error: null,
    data: {
      customers: (customersResponse.data ?? []) as CustomerSummaryRow[],
      projects: (projectsResponse.data ?? []) as ProjectSummaryRow[],
      profiles: (profilesResponse.data ?? []) as ProfileSummaryRow[],
      estimates: (estimatesResponse.data ?? []) as EstimateSummaryRow[],
      invoices: (invoicesResponse.data ?? []) as InvoiceSummaryRow[],
    },
  };
}

export async function loadChangeOrderById(
  supabase: SupabaseClient<Database>,
  companyId: string,
  changeOrderId: string,
): Promise<{ error: string | null; data: ChangeOrderRecordWithChildren | null }> {
  const [changeOrderResponse, lineItemsResponse, notesResponse, activityResponse, invoiceLinksResponse] = await Promise.all([
    supabase
      .from("change_orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", changeOrderId)
      .maybeSingle<ChangeOrderRow>(),
    supabase
      .from("change_order_line_items")
      .select("*")
      .eq("company_id", companyId)
      .eq("change_order_id", changeOrderId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("change_order_notes")
      .select("*")
      .eq("company_id", companyId)
      .eq("change_order_id", changeOrderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("change_order_activity")
      .select("*")
      .eq("company_id", companyId)
      .eq("change_order_id", changeOrderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("change_order_invoice_links")
      .select("id, invoice_id, amount_applied, link_type, created_at")
      .eq("company_id", companyId)
      .eq("change_order_id", changeOrderId)
      .order("created_at", { ascending: false }),
  ]);

  if (changeOrderResponse.error) {
    return { error: changeOrderResponse.error.message, data: null };
  }

  if (!changeOrderResponse.data) {
    return { error: "Change order not found.", data: null };
  }

  if (lineItemsResponse.error) {
    return { error: lineItemsResponse.error.message, data: null };
  }

  if (notesResponse.error) {
    return { error: notesResponse.error.message, data: null };
  }

  if (activityResponse.error) {
    return { error: activityResponse.error.message, data: null };
  }

  if (invoiceLinksResponse.error) {
    return { error: invoiceLinksResponse.error.message, data: null };
  }

  return {
    error: null,
    data: {
      changeOrder: changeOrderResponse.data,
      lineItems: (lineItemsResponse.data ?? []) as ChangeOrderLineItemRow[],
      notes: (notesResponse.data ?? []) as ChangeOrderNoteRow[],
      activity: (activityResponse.data ?? []) as ChangeOrderActivityRow[],
      invoiceLinks: (invoiceLinksResponse.data ?? []) as ChangeOrderInvoiceLinkSummary[],
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
  changeOrderId: string;
  lineItems: ChangeOrderLineItemDraft[];
}) {
  return params.lineItems
    .filter((item) => item.description.trim().length > 0)
    .map((item, index) => {
      const money = changeOrderLineItemMoney(item);

      const lineItemRecord: ChangeOrderLineItemInsert = {
        company_id: params.companyId,
        change_order_id: params.changeOrderId,
        sort_order: index,
        description: item.description.trim(),
        quantity: money.quantity,
        unit: item.unit,
        unit_cost: money.unitCost,
        unit_price: money.unitPrice,
        cost_amount: money.costAmount,
        price_amount: money.priceAmount,
        notes: item.notes.trim() || null,
      };

      return lineItemRecord;
    });
}

function normalizeStatusForSave(status: string): ChangeOrderStatus {
  const normalized = normalizeChangeOrderStatus(status);

  if (WORKFLOW_STATUSES.includes(normalized as ChangeOrderStatus)) {
    return normalized as ChangeOrderStatus;
  }

  return "draft";
}

async function logChangeOrderActivity(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string | null;
  activityType: Database["public"]["Tables"]["change_order_activity"]["Insert"]["activity_type"];
  description: string;
  metadata?: Json;
}) {
  await params.supabase
    .from("change_order_activity")
    .insert({
      company_id: params.companyId,
      change_order_id: params.changeOrderId,
      activity_type: params.activityType,
      description: params.description,
      metadata: params.metadata ?? {},
      created_by: params.userId,
    });
}

export async function saveChangeOrder(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  userId: string;
  values: ChangeOrderFormValues;
  lineItems: ChangeOrderLineItemDraft[];
  changeOrderId?: string;
}) {
  const totals = calculateChangeOrderTotals({
    lineItems: params.lineItems,
    taxRatePercent: params.values.taxRatePercent,
  });

  const changeOrderNumber = params.values.changeOrderNumber.trim()
    || await getNextChangeOrderNumber(params.supabase, params.companyId);

  const status = normalizeStatusForSave(params.values.status);

  const payload: ChangeOrderInsert = {
    company_id: params.companyId,
    change_order_number: changeOrderNumber,
    title: params.values.title.trim(),
    description: params.values.description.trim() || null,
    status,
    customer_id: params.values.customerId || null,
    project_id: params.values.projectId,
    estimate_id: params.values.estimateId || null,
    requested_by: params.values.requestedBy || null,
    prepared_by: params.values.preparedBy || null,
    requested_date: params.values.requestedDate || null,
    effective_date: params.values.effectiveDate || null,
    schedule_impact_days: Number(params.values.scheduleImpactDays || 0),
    reason: params.values.reason.trim() || null,
    customer_notes: params.values.customerNotes.trim() || null,
    internal_notes: params.values.internalNotes.trim() || null,
    subtotal: totals.subtotal,
    tax_rate: Number(params.values.taxRatePercent || 0) / 100,
    tax_amount: totals.taxTotal,
    total_amount: totals.grandTotal,
    archived_at: status === "void" ? new Date().toISOString() : null,
    created_by: params.userId,
    updated_by: params.userId,
    submitted_at: status === "pending_approval" ? new Date().toISOString() : null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    rejected_at: status === "rejected" ? new Date().toISOString() : null,
  };

  let changeOrderId = params.changeOrderId;

  if (changeOrderId) {
    const { error: updateError } = await params.supabase
      .from("change_orders")
      .update({
        ...payload,
        company_id: undefined,
        created_by: undefined,
      })
      .eq("company_id", params.companyId)
      .eq("id", changeOrderId);

    if (updateError) {
      return { error: updateError.message, changeOrderId: null };
    }

    await logChangeOrderActivity({
      supabase: params.supabase,
      companyId: params.companyId,
      changeOrderId,
      userId: params.userId,
      activityType: "updated",
      description: "Change order updated.",
    });
  } else {
    const { data: inserted, error: insertError } = await params.supabase
      .from("change_orders")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      return { error: insertError.message, changeOrderId: null };
    }

    changeOrderId = inserted.id;

    await logChangeOrderActivity({
      supabase: params.supabase,
      companyId: params.companyId,
      changeOrderId,
      userId: params.userId,
      activityType: "created",
      description: "Change order created.",
    });
  }

  if (!changeOrderId) {
    return { error: "Unable to resolve change order record.", changeOrderId: null };
  }

  const { error: deleteItemsError } = await params.supabase
    .from("change_order_line_items")
    .delete()
    .eq("company_id", params.companyId)
    .eq("change_order_id", changeOrderId);

  if (deleteItemsError) {
    return { error: deleteItemsError.message, changeOrderId: null };
  }

  const nextLineItems = mapLineItemsForInsert({
    companyId: params.companyId,
    changeOrderId,
    lineItems: params.lineItems,
  });

  if (nextLineItems.length > 0) {
    const { error: insertItemsError } = await params.supabase
      .from("change_order_line_items")
      .insert(nextLineItems);

    if (insertItemsError) {
      return { error: insertItemsError.message, changeOrderId: null };
    }
  }

  return { error: null, changeOrderId };
}

function canTransition(current: ChangeOrderStatus, next: ChangeOrderStatus) {
  if (current === next) {
    return true;
  }

  if (current === "draft" && next === "pending_approval") {
    return true;
  }

  if (current === "pending_approval" && (next === "approved" || next === "rejected")) {
    return true;
  }

  if ((current === "approved" || current === "rejected") && next === "draft") {
    return true;
  }

  if (current === "approved" && next === "invoiced") {
    return true;
  }

  if (["draft", "pending_approval", "approved", "rejected"].includes(current) && next === "void") {
    return true;
  }

  return false;
}

async function updateWorkflowStatus(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
  nextStatus: ChangeOrderStatus;
  activityType: Database["public"]["Tables"]["change_order_activity"]["Insert"]["activity_type"];
  activityDescription: string;
  rejectionReason?: string;
}) {
  const record = await loadChangeOrderById(params.supabase, params.companyId, params.changeOrderId);

  if (record.error || !record.data) {
    return { error: record.error || "Change order not found." };
  }

  const current = normalizeStatusForSave(record.data.changeOrder.status);

  if (!canTransition(current, params.nextStatus)) {
    return { error: `Invalid status transition from ${current} to ${params.nextStatus}.` };
  }

  const updatePayload: Database["public"]["Tables"]["change_orders"]["Update"] = {
    status: params.nextStatus,
    updated_by: params.userId,
  };

  if (params.nextStatus === "pending_approval") {
    updatePayload.submitted_at = new Date().toISOString();
  }

  if (params.nextStatus === "approved") {
    updatePayload.approved_at = new Date().toISOString();
    updatePayload.approved_by = params.userId;
    updatePayload.rejected_at = null;
    updatePayload.rejected_by = null;
  }

  if (params.nextStatus === "rejected") {
    updatePayload.rejected_at = new Date().toISOString();
    updatePayload.rejected_by = params.userId;
    if (params.rejectionReason?.trim()) {
      updatePayload.internal_notes = [
        record.data.changeOrder.internal_notes?.trim() || "",
        `Rejection reason: ${params.rejectionReason.trim()}`,
      ].filter(Boolean).join("\n\n");
    }
  }

  if (params.nextStatus === "draft") {
    updatePayload.submitted_at = null;
    updatePayload.approved_at = null;
    updatePayload.approved_by = null;
    updatePayload.rejected_at = null;
    updatePayload.rejected_by = null;
  }

  if (params.nextStatus === "void") {
    updatePayload.archived_at = new Date().toISOString();
  }

  const { error } = await params.supabase
    .from("change_orders")
    .update(updatePayload)
    .eq("company_id", params.companyId)
    .eq("id", params.changeOrderId);

  if (error) {
    return { error: error.message };
  }

  await logChangeOrderActivity({
    supabase: params.supabase,
    companyId: params.companyId,
    changeOrderId: params.changeOrderId,
    userId: params.userId,
    activityType: params.activityType,
    description: params.activityDescription,
    metadata: {
      previousStatus: current,
      nextStatus: params.nextStatus,
    },
  });

  return { error: null };
}

export async function submitForApproval(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
}) {
  return updateWorkflowStatus({
    ...params,
    nextStatus: "pending_approval",
    activityType: "submitted",
    activityDescription: "Change order submitted for approval.",
  });
}

export async function approveChangeOrder(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
}) {
  return updateWorkflowStatus({
    ...params,
    nextStatus: "approved",
    activityType: "approved",
    activityDescription: "Change order approved.",
  });
}

export async function rejectChangeOrder(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
  reason?: string;
}) {
  return updateWorkflowStatus({
    ...params,
    nextStatus: "rejected",
    activityType: "rejected",
    activityDescription: "Change order rejected.",
    rejectionReason: params.reason,
  });
}

export async function reopenChangeOrder(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
}) {
  return updateWorkflowStatus({
    ...params,
    nextStatus: "draft",
    activityType: "reopened",
    activityDescription: "Change order reopened to draft.",
  });
}

export async function voidChangeOrder(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
}) {
  return updateWorkflowStatus({
    ...params,
    nextStatus: "void",
    activityType: "status_changed",
    activityDescription: "Change order marked as void.",
  });
}

export async function archiveChangeOrder(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
}) {
  const { error } = await params.supabase
    .from("change_orders")
    .update({
      archived_at: new Date().toISOString(),
      updated_by: params.userId,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.changeOrderId);

  if (error) {
    return { error: error.message };
  }

  await logChangeOrderActivity({
    supabase: params.supabase,
    companyId: params.companyId,
    changeOrderId: params.changeOrderId,
    userId: params.userId,
    activityType: "archived",
    description: "Change order archived.",
  });

  return { error: null };
}

export async function restoreChangeOrder(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
}) {
  const { error } = await params.supabase
    .from("change_orders")
    .update({
      archived_at: null,
      updated_by: params.userId,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.changeOrderId);

  if (error) {
    return { error: error.message };
  }

  await logChangeOrderActivity({
    supabase: params.supabase,
    companyId: params.companyId,
    changeOrderId: params.changeOrderId,
    userId: params.userId,
    activityType: "restored",
    description: "Change order restored.",
  });

  return { error: null };
}

export async function addChangeOrderNote(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
  note: string;
  visibility?: "internal" | "customer";
}) {
  const noteValue = params.note.trim();

  if (!noteValue) {
    return { error: "Note is required." };
  }

  const { error } = await params.supabase
    .from("change_order_notes")
    .insert({
      company_id: params.companyId,
      change_order_id: params.changeOrderId,
      note: noteValue,
      visibility: params.visibility || "internal",
      created_by: params.userId,
      updated_by: params.userId,
    });

  if (error) {
    return { error: error.message };
  }

  await logChangeOrderActivity({
    supabase: params.supabase,
    companyId: params.companyId,
    changeOrderId: params.changeOrderId,
    userId: params.userId,
    activityType: "note_added",
    description: "A note was added.",
    metadata: { visibility: params.visibility || "internal" },
  });

  return { error: null };
}

export async function listChangeOrderNotes(
  supabase: SupabaseClient<Database>,
  companyId: string,
  changeOrderId: string,
) {
  const { data, error } = await supabase
    .from("change_order_notes")
    .select("*")
    .eq("company_id", companyId)
    .eq("change_order_id", changeOrderId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, notes: [] as ChangeOrderNoteRow[] };
  }

  return { error: null, notes: (data ?? []) as ChangeOrderNoteRow[] };
}

export async function listChangeOrderActivity(
  supabase: SupabaseClient<Database>,
  companyId: string,
  changeOrderId: string,
) {
  const { data, error } = await supabase
    .from("change_order_activity")
    .select("*")
    .eq("company_id", companyId)
    .eq("change_order_id", changeOrderId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, activity: [] as ChangeOrderActivityRow[] };
  }

  return { error: null, activity: (data ?? []) as ChangeOrderActivityRow[] };
}

async function getChangeOrderForInvoicing(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
}) {
  const record = await loadChangeOrderById(params.supabase, params.companyId, params.changeOrderId);

  if (record.error || !record.data) {
    return { error: record.error || "Change order not found.", data: null };
  }

  const status = normalizeStatusForSave(record.data.changeOrder.status);

  if (status !== "approved") {
    return { error: "Only approved change orders can be invoiced.", data: null };
  }

  if (record.data.changeOrder.archived_at) {
    return { error: "Archived change orders must be restored before invoicing.", data: null };
  }

  return { error: null, data: record.data };
}

export async function addChangeOrderToExistingInvoice(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  invoiceId: string;
  userId: string;
  linkType?: "manual" | "converted" | "partial";
}) {
  const source = await getChangeOrderForInvoicing({
    supabase: params.supabase,
    companyId: params.companyId,
    changeOrderId: params.changeOrderId,
  });

  if (source.error || !source.data) {
    return { error: source.error || "Change order not found." };
  }

  const existingLink = await params.supabase
    .from("change_order_invoice_links")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("change_order_id", params.changeOrderId)
    .eq("invoice_id", params.invoiceId)
    .maybeSingle();

  if (existingLink.data?.id) {
    return { error: "This change order is already linked to the selected invoice." };
  }

  const invoiceResult = await params.supabase
    .from("invoices")
    .select("id, customer_id, project_id")
    .eq("company_id", params.companyId)
    .eq("id", params.invoiceId)
    .maybeSingle();

  if (invoiceResult.error || !invoiceResult.data) {
    return { error: invoiceResult.error?.message || "Invoice not found." };
  }

  const changeOrder = source.data.changeOrder;

  if (changeOrder.customer_id && invoiceResult.data.customer_id && changeOrder.customer_id !== invoiceResult.data.customer_id) {
    return { error: "Invoice customer does not match the change order customer." };
  }

  if (changeOrder.project_id && invoiceResult.data.project_id && changeOrder.project_id !== invoiceResult.data.project_id) {
    return { error: "Invoice project does not match the change order project." };
  }

  const { data: existingInvoiceLines } = await params.supabase
    .from("invoice_line_items")
    .select("sort_order")
    .eq("company_id", params.companyId)
    .eq("invoice_id", params.invoiceId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const baseSortOrder = (existingInvoiceLines?.[0]?.sort_order ?? 0) + 1;

  const invoiceLineInserts = source.data.lineItems
    .filter((lineItem) => lineItem.description.trim().length > 0)
    .map((lineItem, index) => ({
      company_id: params.companyId,
      invoice_id: params.invoiceId,
      sort_order: baseSortOrder + index,
      description: `${changeOrder.change_order_number} - ${lineItem.description}`,
      quantity: lineItem.quantity,
      unit: lineItem.unit,
      rate: lineItem.unit_price,
      amount: lineItem.price_amount,
      notes: lineItem.notes,
    }));

  if (invoiceLineInserts.length > 0) {
    const { error: lineInsertError } = await params.supabase
      .from("invoice_line_items")
      .insert(invoiceLineInserts);

    if (lineInsertError) {
      return { error: lineInsertError.message };
    }
  }

  const { error: linkError } = await params.supabase
    .from("change_order_invoice_links")
    .insert({
      company_id: params.companyId,
      change_order_id: params.changeOrderId,
      invoice_id: params.invoiceId,
      link_type: params.linkType || "manual",
      amount_applied: changeOrder.total_amount,
      created_by: params.userId,
    });

  if (linkError) {
    return { error: linkError.message };
  }

  const { error: updateError } = await params.supabase
    .from("change_orders")
    .update({
      invoice_id: params.invoiceId,
      status: "invoiced",
      updated_by: params.userId,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.changeOrderId);

  if (updateError) {
    return { error: updateError.message };
  }

  await logChangeOrderActivity({
    supabase: params.supabase,
    companyId: params.companyId,
    changeOrderId: params.changeOrderId,
    userId: params.userId,
    activityType: "invoiced",
    description: "Change order added to an invoice.",
    metadata: {
      invoiceId: params.invoiceId,
      copiedLineItems: invoiceLineInserts.length,
    },
  });

  return { error: null };
}

export async function createInvoiceFromChangeOrder(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrderId: string;
  userId: string;
}) {
  const source = await getChangeOrderForInvoicing({
    supabase: params.supabase,
    companyId: params.companyId,
    changeOrderId: params.changeOrderId,
  });

  if (source.error || !source.data) {
    return { error: source.error || "Change order not found.", invoiceId: null };
  }

  const changeOrder = source.data.changeOrder;

  const invoiceValues: InvoiceFormValues = {
    title: `${changeOrder.title} Invoice`,
    invoiceNumber: "",
    customerId: changeOrder.customer_id || "",
    projectId: changeOrder.project_id,
    estimateId: changeOrder.estimate_id || "",
    preparedBy: changeOrder.prepared_by || "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    status: "draft",
    description: changeOrder.description || "",
    discountType: "none",
    discountValue: "0",
    taxRatePercent: String((changeOrder.tax_rate || 0) * 100),
    additionalFee: "0",
    notes: [
      `Created from change order ${changeOrder.change_order_number}`,
      changeOrder.customer_notes || "",
    ].filter(Boolean).join("\n\n"),
    paymentTerms: "",
  };

  const invoiceLineItems = source.data.lineItems.map((lineItem, index) => ({
    id: `${lineItem.id}-${index}`,
    sortOrder: index,
    description: `${changeOrder.change_order_number} - ${lineItem.description}`,
    quantity: String(lineItem.quantity),
    unit: lineItem.unit as InvoiceFormValues["status"] extends never ? never : "each" | "hour" | "day" | "week" | "square_foot" | "linear_foot" | "cubic_yard" | "lump_sum",
    rate: String(lineItem.unit_price),
    notes: lineItem.notes || "",
  }));

  const savedInvoice = await saveInvoice({
    supabase: params.supabase,
    companyId: params.companyId,
    userId: params.userId,
    values: invoiceValues,
    lineItems: invoiceLineItems,
  });

  if (savedInvoice.error || !savedInvoice.invoiceId) {
    return { error: savedInvoice.error || "Unable to create invoice.", invoiceId: null };
  }

  const linkResult = await addChangeOrderToExistingInvoice({
    supabase: params.supabase,
    companyId: params.companyId,
    changeOrderId: params.changeOrderId,
    invoiceId: savedInvoice.invoiceId,
    userId: params.userId,
    linkType: "converted",
  });

  if (linkResult.error) {
    return { error: linkResult.error, invoiceId: null };
  }

  return { error: null, invoiceId: savedInvoice.invoiceId };
}

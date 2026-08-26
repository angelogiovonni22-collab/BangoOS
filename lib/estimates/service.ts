import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateEstimateTotals, lineItemMoney } from "@/lib/estimates/calculations";
import { getNextEstimateNumber } from "@/lib/estimates/numbering";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import type {
  EstimateFormValues,
  EstimateLineItemDraft,
  EstimateLineItemInsert,
  EstimateLineItemRow,
  EstimateRow,
  EstimateStatus,
} from "@/lib/estimates/types";
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

export type EstimateDirectoryRecord = Pick<
  EstimateRow,
  | "id"
  | "title"
  | "estimate_number"
  | "customer_id"
  | "project_id"
  | "status"
  | "issue_date"
  | "expiration_date"
  | "total_amount"
  | "updated_at"
  | "archived_at"
>;

export type EstimateFormOptions = {
  customers: CustomerSummaryRow[];
  projects: ProjectSummaryRow[];
  profiles: ProfileSummaryRow[];
};

export type EstimateRecordWithItems = {
  estimate: EstimateRow;
  lineItems: EstimateLineItemRow[];
};

export async function loadEstimateDirectoryData(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const [estimatesResponse, customersResponse, projectsResponse] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, title, estimate_number, customer_id, project_id, status, issue_date, expiration_date, total_amount, updated_at, archived_at")
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

  if (estimatesResponse.error) {
    return { error: estimatesResponse.error.message };
  }

  if (customersResponse.error) {
    return { error: customersResponse.error.message };
  }

  if (projectsResponse.error) {
    return { error: projectsResponse.error.message };
  }

  return {
    error: null,
    estimates: (estimatesResponse.data ?? []) as EstimateDirectoryRecord[],
    customers: (customersResponse.data ?? []) as CustomerSummaryRow[],
    projects: (projectsResponse.data ?? []) as ProjectSummaryRow[],
  };
}

export async function loadEstimateFormOptions(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<{ error: string | null; data: EstimateFormOptions | null }> {
  const [customersResponse, projectsResponse, profilesResponse] = await Promise.all([
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

  return {
    error: null,
    data: {
      customers: (customersResponse.data ?? []) as CustomerSummaryRow[],
      projects: (projectsResponse.data ?? []) as ProjectSummaryRow[],
      profiles: (profilesResponse.data ?? []) as ProfileSummaryRow[],
    },
  };
}

export async function loadEstimateById(
  supabase: SupabaseClient<Database>,
  companyId: string,
  estimateId: string,
): Promise<{ error: string | null; data: EstimateRecordWithItems | null }> {
  const [estimateResponse, lineItemsResponse] = await Promise.all([
    supabase
      .from("estimates")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", estimateId)
      .maybeSingle<EstimateRow>(),
    supabase
      .from("estimate_line_items")
      .select("*")
      .eq("company_id", companyId)
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
  ]);

  if (estimateResponse.error) {
    return { error: estimateResponse.error.message, data: null };
  }

  if (!estimateResponse.data) {
    return { error: "Estimate not found.", data: null };
  }

  if (lineItemsResponse.error) {
    return { error: lineItemsResponse.error.message, data: null };
  }

  return {
    error: null,
    data: {
      estimate: estimateResponse.data,
      lineItems: (lineItemsResponse.data ?? []) as EstimateLineItemRow[],
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
  estimateId: string;
  lineItems: EstimateLineItemDraft[];
}) {
  return params.lineItems
    .filter((item) => item.description.trim().length > 0)
    .map((item, index) => {
      const money = lineItemMoney(item);

      const lineItemRecord: EstimateLineItemInsert = {
        company_id: params.companyId,
        estimate_id: params.estimateId,
        sort_order: index,
        item_code: item.itemCode.trim() || null,
        category: item.category,
        description: item.description.trim(),
        quantity: money.quantity,
        unit: item.unit,
        unit_cost: money.unitCost,
        markup_percent: money.markupPercent,
        unit_price: money.unitPrice,
        line_total: money.lineTotal,
        notes: item.notes.trim() || null,
        material_id: item.materialId || null,
        supplier_price_entry_id: item.supplierPriceEntryId || null,
        supplier_vendor_id: item.supplierVendorId || null,
        cost_source: item.costSource || null,
        cost_verified_on: item.costVerifiedOn || null,
        supplier_unit_cost_snapshot: item.supplierUnitCostSnapshot ? Number(item.supplierUnitCostSnapshot) : null,
        cost_override: Boolean(item.costOverride),
      };

      return lineItemRecord;
    });
}

export async function saveEstimate(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  userId: string;
  values: EstimateFormValues;
  lineItems: EstimateLineItemDraft[];
  estimateId?: string;
}) {
  const totals = calculateEstimateTotals({
    lineItems: params.lineItems,
    discountType: params.values.discountType,
    discountValue: params.values.discountValue,
    taxRatePercent: params.values.taxRatePercent,
    additionalFee: params.values.additionalFee,
  });

  const estimateNumber = params.values.estimateNumber.trim()
    || await getNextEstimateNumber(params.supabase, params.companyId);

  const estimatePayload: Database["public"]["Tables"]["estimates"]["Insert"] = {
    company_id: params.companyId,
    title: params.values.title.trim(),
    estimate_number: estimateNumber,
    customer_id: params.values.customerId || null,
    project_id: params.values.projectId || null,
    issue_date: params.values.issueDate || null,
    expiration_date: params.values.expirationDate || null,
    prepared_by: params.values.preparedBy || null,
    status: params.values.status,
    description: params.values.description.trim() || null,
    direct_cost_subtotal: totals.directCostSubtotal,
    markup_total: totals.markupTotal,
    subtotal: totals.estimateSubtotal,
    discount_type: params.values.discountType,
    discount_value: Number(params.values.discountValue || 0),
    discount_total: totals.discountTotal,
    tax_rate: Number(params.values.taxRatePercent || 0) / 100,
    tax_amount: totals.taxTotal,
    additional_fee: totals.additionalFee,
    total_amount: totals.grandTotal,
    internal_notes: params.values.internalNotes.trim() || null,
    customer_notes: params.values.customerNotes.trim() || null,
    scope_inclusions: params.values.scopeInclusions.trim() || null,
    scope_exclusions: params.values.scopeExclusions.trim() || null,
    terms: params.values.terms.trim() || null,
    payment_terms: params.values.paymentTerms.trim() || null,
    created_by: params.userId,
    updated_by: params.userId,
    archived_at: params.values.status === "archived" ? new Date().toISOString() : null,
  };

  let estimateId = params.estimateId;
  const isCreate = !estimateId;
  const orion = createSupabaseOrionEventPublisher(params.supabase);

  if (estimateId) {
    const { error: updateError } = await params.supabase
      .from("estimates")
      .update({
        ...estimatePayload,
        company_id: undefined,
      })
      .eq("company_id", params.companyId)
      .eq("id", estimateId);

    if (updateError) {
      return { error: updateError.message, estimateId: null };
    }
  } else {
    const { data: insertedEstimate, error: insertError } = await params.supabase
      .from("estimates")
      .insert(estimatePayload)
      .select("id")
      .single();

    if (insertError) {
      return { error: insertError.message, estimateId: null };
    }

    estimateId = insertedEstimate.id;
  }

  if (!estimateId) {
    return { error: "Unable to resolve estimate record.", estimateId: null };
  }

  const { error: deleteItemsError } = await params.supabase
    .from("estimate_line_items")
    .delete()
    .eq("company_id", params.companyId)
    .eq("estimate_id", estimateId);

  if (deleteItemsError) {
    return { error: deleteItemsError.message, estimateId: null };
  }

  const nextLineItems = mapLineItemsForInsert({
    companyId: params.companyId,
    estimateId,
    lineItems: params.lineItems,
  });

  if (nextLineItems.length > 0) {
    const { error: lineItemsError } = await params.supabase
      .from("estimate_line_items")
      .insert(nextLineItems);

    if (lineItemsError) {
      return { error: lineItemsError.message, estimateId: null };
    }
  }

  const { error: recalcError } = await params.supabase.rpc("recalc_estimate_totals", {
    p_estimate_id: estimateId,
  });

  if (recalcError) {
    return { error: recalcError.message, estimateId: null };
  }

  if (isCreate) {
    await orion.publishEvent({
      company_id: params.companyId,
      actor_profile_id: params.userId,
      event_type: "estimate.created",
      aggregate_type: "estimate",
      aggregate_id: estimateId,
      source_module: "estimates",
      payload: {
        estimate_number: estimateNumber,
        title: estimatePayload.title,
        status: estimatePayload.status,
        customer_id: estimatePayload.customer_id,
        project_id: estimatePayload.project_id,
        total_amount: estimatePayload.total_amount,
        deep_link: `/estimates/${estimateId}`,
      },
      metadata: {
        workflow_name: "estimate_lifecycle",
        event_category: "sales",
        event_severity: "info",
        deep_link: `/estimates/${estimateId}`,
      },
    });
  } else {
    await orion.publishEvent({
      company_id: params.companyId,
      actor_profile_id: params.userId,
      event_type: "estimate.updated",
      aggregate_type: "estimate",
      aggregate_id: estimateId,
      source_module: "estimates",
      payload: {
        estimate_id: estimateId,
        estimate_number: estimateNumber,
        status: estimatePayload.status,
        customer_id: estimatePayload.customer_id,
        project_id: estimatePayload.project_id,
        total_amount: estimatePayload.total_amount,
        deep_link: `/estimates/${estimateId}`,
      },
      metadata: {
        workflow_name: "estimate_lifecycle",
        event_category: "sales",
        event_severity: "info",
        deep_link: `/estimates/${estimateId}`,
      },
    });
  }

  return { error: null, estimateId };
}

export async function duplicateEstimate(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  userId: string;
  estimateId: string;
}) {
  const estimateResponse = await loadEstimateById(params.supabase, params.companyId, params.estimateId);

  if (estimateResponse.error || !estimateResponse.data) {
    return { error: estimateResponse.error || "Estimate not found", duplicatedId: null };
  }

  const { estimate, lineItems } = estimateResponse.data;
  const nextEstimateNumber = await getNextEstimateNumber(params.supabase, params.companyId);

  const insertPayload: Database["public"]["Tables"]["estimates"]["Insert"] = {
    company_id: params.companyId,
    title: `${estimate.title} (Copy)`,
    estimate_number: nextEstimateNumber,
    customer_id: estimate.customer_id,
    project_id: estimate.project_id,
    issue_date: estimate.issue_date,
    expiration_date: estimate.expiration_date,
    prepared_by: estimate.prepared_by,
    status: "draft" as EstimateStatus,
    description: estimate.description,
    direct_cost_subtotal: estimate.direct_cost_subtotal,
    markup_total: estimate.markup_total,
    subtotal: estimate.subtotal,
    discount_type: estimate.discount_type,
    discount_value: estimate.discount_value,
    discount_total: estimate.discount_total,
    tax_rate: estimate.tax_rate,
    tax_amount: estimate.tax_amount,
    additional_fee: estimate.additional_fee,
    total_amount: estimate.total_amount,
    internal_notes: estimate.internal_notes,
    customer_notes: estimate.customer_notes,
    scope_inclusions: estimate.scope_inclusions,
    scope_exclusions: estimate.scope_exclusions,
    terms: estimate.terms,
    payment_terms: estimate.payment_terms,
    created_by: params.userId,
    updated_by: params.userId,
  };

  const { data: insertedEstimate, error: insertError } = await params.supabase
    .from("estimates")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError || !insertedEstimate?.id) {
    return { error: insertError?.message || "Unable to duplicate estimate", duplicatedId: null };
  }

  if (lineItems.length > 0) {
    const duplicatedLineItems: EstimateLineItemInsert[] = lineItems.map((lineItem) => ({
      company_id: params.companyId,
      estimate_id: insertedEstimate.id,
      sort_order: lineItem.sort_order,
      item_code: lineItem.item_code,
      category: lineItem.category,
      description: lineItem.description,
      quantity: lineItem.quantity,
      unit: lineItem.unit,
      unit_cost: lineItem.unit_cost,
      markup_percent: lineItem.markup_percent,
      unit_price: lineItem.unit_price,
      line_total: lineItem.line_total,
      notes: lineItem.notes,
    }));

    const { error: lineItemsError } = await params.supabase
      .from("estimate_line_items")
      .insert(duplicatedLineItems);

    if (lineItemsError) {
      return { error: lineItemsError.message, duplicatedId: null };
    }
  }

  return { error: null, duplicatedId: insertedEstimate.id };
}

export async function archiveEstimate(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  estimateId: string;
  userId: string;
}) {
  const nowIso = new Date().toISOString();
  const { error } = await params.supabase
    .from("estimates")
    .update({
      status: "archived",
      archived_at: nowIso,
      updated_by: params.userId,
    })
    .eq("company_id", params.companyId)
    .eq("id", params.estimateId);

  if (!error) {
    const orion = createSupabaseOrionEventPublisher(params.supabase);
    await orion.publishEvent({
      company_id: params.companyId,
      actor_profile_id: params.userId,
      event_type: "estimate.expired",
      aggregate_type: "estimate",
      aggregate_id: params.estimateId,
      source_module: "estimates",
      occurred_at: nowIso,
      payload: {
        estimate_id: params.estimateId,
        archived_at: nowIso,
        deep_link: `/estimates/${params.estimateId}`,
      },
      metadata: {
        workflow_name: "estimate_lifecycle",
        event_category: "sales",
        event_severity: "attention",
        deep_link: `/estimates/${params.estimateId}`,
      },
    });
  }

  return { error: error?.message || null };
}

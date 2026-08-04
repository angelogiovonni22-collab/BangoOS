import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  mapTimelineItem,
  mapWorkflowEventRow,
  timelineDedupeKey,
  type TimelineRawRecord,
} from "./timeline-mappers";
import type {
  OrionTimelineContextMaps,
  OrionTimelineCursor,
  OrionTimelineItem,
  OrionTimelineQueryFilters,
  OrionTimelineQueryResult,
} from "./timeline-types";

type WorkflowEventRow = {
  id: string;
  company_id: string;
  event_type: string;
  reference_entity: string;
  reference_id: string;
  source_module: string | null;
  actor_profile_id: string | null;
  occurred_at: string;
  correlation_id: string | null;
  causation_id: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type InvoicePaymentLegacyRow = {
  id: string;
  company_id: string;
  invoice_id: string;
  created_by: string | null;
  created_at: string;
  payment_date: string;
  amount: number;
};

type ChangeOrderLegacyRow = {
  id: string;
  company_id: string;
  change_order_id: string;
  activity_type: string;
  description: string;
  created_by: string | null;
  created_at: string;
};

type WorkforceLegacyRow = {
  id: string;
  company_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_profile_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const OVERFETCH_MULTIPLIER = 4;

type EstimateContextRow = {
  id: string;
  estimate_number: string | null;
  project_id: string | null;
  customer_id: string | null;
  title: string | null;
};

type InvoiceContextRow = {
  id: string;
  invoice_number: string | null;
  project_id: string | null;
  customer_id: string | null;
  title: string | null;
};

type ChangeOrderContextRow = {
  id: string;
  change_order_number: string | null;
  project_id: string | null;
  customer_id: string | null;
  title: string | null;
};

type ProfileContextRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ProjectContextRow = {
  id: string;
  name: string | null;
};

type CustomerContextRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  customer_type: string | null;
};

type LooseTimelineQueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

type LooseTimelineQueryBuilder = {
  eq: (column: string, value: unknown) => LooseTimelineQueryBuilder;
  in: (column: string, values: readonly string[]) => LooseTimelineQueryBuilder;
  gte: (column: string, value: string) => LooseTimelineQueryBuilder;
  lte: (column: string, value: string) => LooseTimelineQueryBuilder;
  order: (column: string, options: { ascending: boolean }) => LooseTimelineQueryBuilder;
  limit: (count: number) => LooseTimelineQueryBuilder;
  then: Promise<LooseTimelineQueryResult>["then"];
};

function toIso(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parsePageSize(value: number | undefined) {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(value)));
}

function compareItemsDesc(left: OrionTimelineItem, right: OrionTimelineItem) {
  if (left.occurredAt === right.occurredAt) {
    return right.id.localeCompare(left.id);
  }

  return right.occurredAt.localeCompare(left.occurredAt);
}

function isAfterCursor(item: OrionTimelineItem, cursor: OrionTimelineCursor) {
  if (item.occurredAt < cursor.occurredAt) {
    return true;
  }

  if (item.occurredAt > cursor.occurredAt) {
    return false;
  }

  return item.id < cursor.id;
}

function normalizeSearchValue(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

function matchesSearch(item: OrionTimelineItem, searchText: string) {
  if (!searchText) {
    return true;
  }

  const haystack = [
    item.title,
    item.summary,
    item.eventType,
    item.entityType,
    item.sourceModule,
    item.projectName || "",
    item.customerName || "",
    item.actorName || "",
  ].join(" ").toLowerCase();

  return haystack.includes(searchText);
}

function mapWorkforceLegacyEvent(eventType: string) {
  if (eventType === "workforce.employee.created") {
    return "employee.created";
  }

  if (eventType === "workforce.employee.updated" || eventType === "workforce.employee.archived") {
    return "employee.updated";
  }

  if (eventType === "workforce.crew.created") {
    return "crew.created";
  }

  if (eventType === "workforce.crew.updated") {
    return "crew.updated";
  }

  if (
    eventType === "workforce.crew_membership.added"
    || eventType === "workforce.crew_membership.updated"
    || eventType === "workforce.crew_membership.ended"
  ) {
    return "crew.assigned";
  }

  return "workflow.executed";
}

async function loadContextMaps(supabase: SupabaseClient<Database>, companyId: string, records: TimelineRawRecord[]): Promise<OrionTimelineContextMaps> {
  const estimateIds = new Set<string>();
  const invoiceIds = new Set<string>();
  const changeOrderIds = new Set<string>();
  const profileIds = new Set<string>();
  const projectIds = new Set<string>();
  const customerIds = new Set<string>();

  for (const record of records) {
    if (record.entityType === "estimate") {
      estimateIds.add(record.entityId);
    }

    if (record.entityType === "invoice") {
      invoiceIds.add(record.entityId);
    }

    if (record.entityType === "change_order") {
      changeOrderIds.add(record.entityId);
    }

    if (record.actorProfileId) {
      profileIds.add(record.actorProfileId);
    }

    const payloadProjectId = typeof record.payload.project_id === "string" ? record.payload.project_id : null;
    const payloadCustomerId = typeof record.payload.customer_id === "string" ? record.payload.customer_id : null;

    if (record.entityType === "project") {
      projectIds.add(record.entityId);
    }

    if (record.entityType === "customer") {
      customerIds.add(record.entityId);
    }

    if (payloadProjectId) {
      projectIds.add(payloadProjectId);
    }

    if (payloadCustomerId) {
      customerIds.add(payloadCustomerId);
    }
  }

  const [estimatesRes, invoicesRes, changeOrdersRes, profilesRes] = await Promise.all([
    estimateIds.size > 0
      ? supabase
        .from("estimates")
        .select("id, estimate_number, project_id, customer_id, title")
        .eq("company_id", companyId)
        .in("id", [...estimateIds])
      : Promise.resolve({ data: [], error: null }),
    invoiceIds.size > 0
      ? supabase
        .from("invoices")
        .select("id, invoice_number, project_id, customer_id, title")
        .eq("company_id", companyId)
        .in("id", [...invoiceIds])
      : Promise.resolve({ data: [], error: null }),
    changeOrderIds.size > 0
      ? supabase
        .from("change_orders")
        .select("id, change_order_number, project_id, customer_id, title")
        .eq("company_id", companyId)
        .in("id", [...changeOrderIds])
      : Promise.resolve({ data: [], error: null }),
    profileIds.size > 0
      ? supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("company_id", companyId)
        .in("id", [...profileIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (estimatesRes.error || invoicesRes.error || changeOrdersRes.error || profilesRes.error) {
    throw new Error(
      estimatesRes.error?.message
      || invoicesRes.error?.message
      || changeOrdersRes.error?.message
      || profilesRes.error?.message
      || "Unable to resolve timeline context.",
    );
  }

  for (const row of (estimatesRes.data || []) as Array<{ project_id: string | null; customer_id: string | null }>) {
    if (row.project_id) {
      projectIds.add(row.project_id);
    }

    if (row.customer_id) {
      customerIds.add(row.customer_id);
    }
  }

  for (const row of (invoicesRes.data || []) as Array<{ project_id: string | null; customer_id: string | null }>) {
    if (row.project_id) {
      projectIds.add(row.project_id);
    }

    if (row.customer_id) {
      customerIds.add(row.customer_id);
    }
  }

  for (const row of (changeOrdersRes.data || []) as Array<{ project_id: string | null; customer_id: string | null }>) {
    if (row.project_id) {
      projectIds.add(row.project_id);
    }

    if (row.customer_id) {
      customerIds.add(row.customer_id);
    }
  }

  const [projectsRes, customersRes] = await Promise.all([
    projectIds.size > 0
      ? supabase
        .from("projects")
        .select("id, name")
        .eq("company_id", companyId)
        .in("id", [...projectIds])
      : Promise.resolve({ data: [], error: null }),
    customerIds.size > 0
      ? supabase
        .from("customers")
        .select("id, first_name, last_name, company_name, customer_type")
        .eq("company_id", companyId)
        .in("id", [...customerIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (projectsRes.error || customersRes.error) {
    throw new Error(projectsRes.error?.message || customersRes.error?.message || "Unable to resolve timeline labels.");
  }

  const estimateRows = (estimatesRes.data || []) as EstimateContextRow[];
  const invoiceRows = (invoicesRes.data || []) as InvoiceContextRow[];
  const changeOrderRows = (changeOrdersRes.data || []) as ChangeOrderContextRow[];
  const profileRows = (profilesRes.data || []) as ProfileContextRow[];
  const projectRows = (projectsRes.data || []) as ProjectContextRow[];
  const customerRows = (customersRes.data || []) as CustomerContextRow[];

  return {
    estimateById: new Map(estimateRows.map((row) => [row.id, {
      id: row.id,
      estimateNumber: row.estimate_number,
      projectId: row.project_id,
      customerId: row.customer_id,
      title: row.title,
    }])),
    invoiceById: new Map(invoiceRows.map((row) => [row.id, {
      id: row.id,
      invoiceNumber: row.invoice_number,
      projectId: row.project_id,
      customerId: row.customer_id,
      title: row.title,
    }])),
    changeOrderById: new Map(changeOrderRows.map((row) => [row.id, {
      id: row.id,
      changeOrderNumber: row.change_order_number,
      projectId: row.project_id,
      customerId: row.customer_id,
      title: row.title,
    }])),
    profileById: new Map(profileRows.map((row) => [row.id, {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
    }])),
    projectById: new Map(projectRows.map((row) => [row.id, {
      id: row.id,
      name: row.name || "Project",
    }])),
    customerById: new Map(customerRows.map((row) => [row.id, {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      companyName: row.company_name,
      customerType: row.customer_type,
    }])),
  };
}

async function fetchWorkflowRows(
  supabase: SupabaseClient<Database>,
  companyId: string,
  filters: OrionTimelineQueryFilters,
  pageSize: number,
) {
  const limit = Math.min(MAX_PAGE_SIZE * OVERFETCH_MULTIPLIER, pageSize * OVERFETCH_MULTIPLIER);
  let query = supabase
    .from("workflow_events" as unknown as "workforce_events")
    .select("id, company_id, event_type, reference_entity, reference_id, source_module, actor_profile_id, occurred_at, correlation_id, causation_id, payload, metadata")
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit) as unknown as LooseTimelineQueryBuilder;

  const fromIso = toIso(filters.from);
  if (fromIso) {
    query = query.gte("occurred_at", fromIso);
  }

  const toIsoValue = toIso(filters.to);
  if (toIsoValue) {
    query = query.lte("occurred_at", toIsoValue);
  }

  if (filters.eventTypes && filters.eventTypes.length > 0) {
    query = query.in("event_type", filters.eventTypes);
  }

  if (filters.sourceModules && filters.sourceModules.length > 0) {
    query = query.in("source_module", filters.sourceModules);
  }

  if (filters.actorProfileId) {
    query = query.eq("actor_profile_id", filters.actorProfileId);
  }

  if (filters.entityType) {
    query = query.eq("reference_entity", filters.entityType);
  }

  if (filters.entityId) {
    query = query.eq("reference_id", filters.entityId);
  }

  if (filters.cursor) {
    query = query.lte("occurred_at", filters.cursor.occurredAt);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Unable to read Orion timeline events.");
  }

  return (data || []) as WorkflowEventRow[];
}

async function fetchLegacyRows(
  supabase: SupabaseClient<Database>,
  companyId: string,
  filters: OrionTimelineQueryFilters,
  limit: number,
): Promise<TimelineRawRecord[]> {
  const includeLegacy = filters.includeLegacyAdapters ?? true;
  if (!includeLegacy) {
    return [];
  }

  const [paymentsRes, changeOrderActivityRes, workforceRes] = await Promise.all([
    supabase
      .from("invoice_payment_history")
      .select("id, company_id, invoice_id, created_by, created_at, payment_date, amount")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("change_order_activity")
      .select("id, company_id, change_order_id, activity_type, description, created_by, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("workforce_events")
      .select("id, company_id, event_type, entity_type, entity_id, actor_profile_id, payload, occurred_at")
      .eq("company_id", companyId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
  ]);

  if (paymentsRes.error || changeOrderActivityRes.error || workforceRes.error) {
    throw new Error(
      paymentsRes.error?.message
      || changeOrderActivityRes.error?.message
      || workforceRes.error?.message
      || "Unable to read legacy timeline sources.",
    );
  }

  const paymentRecords = ((paymentsRes.data || []) as InvoicePaymentLegacyRow[]).map((row) => ({
    id: `invoice_payment_history:${row.id}`,
    source: "invoice_payment_history" as const,
    companyId: row.company_id,
    eventType: "invoice.paid",
    sourceModule: "invoices",
    entityType: "invoice",
    entityId: row.invoice_id,
    actorProfileId: row.created_by,
    occurredAt: row.created_at || `${row.payment_date}T12:00:00.000Z`,
    correlationId: null,
    causationId: null,
    payload: {
      invoice_id: row.invoice_id,
      amount_paid: row.amount,
      legacy_source_id: row.id,
      project_id: null,
      customer_id: null,
    },
    metadata: {},
  }));

  const changeOrderRecords = ((changeOrderActivityRes.data || []) as ChangeOrderLegacyRow[]).map((row) => ({
    id: `change_order_activity:${row.id}`,
    source: "change_order_activity" as const,
    companyId: row.company_id,
    eventType: row.activity_type === "created" ? "change_order.created" : "workflow.executed",
    sourceModule: "change_orders",
    entityType: "change_order",
    entityId: row.change_order_id,
    actorProfileId: row.created_by,
    occurredAt: row.created_at,
    correlationId: null,
    causationId: null,
    payload: {
      change_order_id: row.change_order_id,
      description: row.description,
      legacy_source_id: row.id,
    },
    metadata: {},
  }));

  const workforceRecords = ((workforceRes.data || []) as WorkforceLegacyRow[]).map((row) => ({
    id: `workforce_events:${row.id}`,
    source: "workforce_events" as const,
    companyId: row.company_id,
    eventType: mapWorkforceLegacyEvent(row.event_type),
    sourceModule: "workforce",
    entityType: row.entity_type === "crew_membership" ? "crew" : row.entity_type,
    entityId: row.entity_id,
    actorProfileId: row.actor_profile_id,
    occurredAt: row.occurred_at,
    correlationId: null,
    causationId: null,
    payload: {
      ...(row.payload || {}),
      legacy_source_id: row.id,
    },
    metadata: {},
  }));

  return [...paymentRecords, ...changeOrderRecords, ...workforceRecords];
}

function applyFilters(items: OrionTimelineItem[], filters: OrionTimelineQueryFilters) {
  const searchText = normalizeSearchValue(filters.searchText);

  return items.filter((item) => {
    if (filters.categories && filters.categories.length > 0 && !filters.categories.includes(item.category)) {
      return false;
    }

    if (filters.severities && filters.severities.length > 0 && !filters.severities.includes(item.severity)) {
      return false;
    }

    if (filters.projectId && item.projectId !== filters.projectId) {
      return false;
    }

    if (filters.customerId && item.customerId !== filters.customerId) {
      return false;
    }

    if (!matchesSearch(item, searchText)) {
      return false;
    }

    if (filters.cursor && !isAfterCursor(item, filters.cursor)) {
      return false;
    }

    return true;
  });
}

function dedupePreferCanonical(items: OrionTimelineItem[]) {
  const byKey = new Map<string, OrionTimelineItem>();

  for (const item of items) {
    const key = timelineDedupeKey(item);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const existingIsCanonical = existing.id.startsWith("workflow:");
    const nextIsCanonical = item.id.startsWith("workflow:");

    if (!existingIsCanonical && nextIsCanonical) {
      byKey.set(key, item);
      continue;
    }

    if (existingIsCanonical === nextIsCanonical) {
      if (item.occurredAt > existing.occurredAt) {
        byKey.set(key, item);
      }
    }
  }

  return [...byKey.values()];
}

export async function queryOrionTimeline(
  supabase: SupabaseClient<Database>,
  companyId: string,
  filters: OrionTimelineQueryFilters = {},
): Promise<OrionTimelineQueryResult> {
  const pageSize = parsePageSize(filters.pageSize);

  const workflowRows = await fetchWorkflowRows(supabase, companyId, filters, pageSize);
  const workflowRecords = workflowRows.map(mapWorkflowEventRow);
  const legacyRecords = await fetchLegacyRows(supabase, companyId, filters, Math.min(pageSize * 2, 80));

  const combinedRecords = [...workflowRecords, ...legacyRecords];
  const contextMaps = await loadContextMaps(supabase, companyId, combinedRecords);
  const mapped = combinedRecords.map((record) => mapTimelineItem(record, contextMaps));
  const deduped = dedupePreferCanonical(mapped);
  const filtered = applyFilters(deduped, filters).sort(compareItemsDesc);

  const page = filtered.slice(0, pageSize);
  const hasMore = filtered.length > pageSize;
  const next = page.length > 0 ? page[page.length - 1] : null;

  return {
    items: page,
    hasMore,
    nextCursor: hasMore && next
      ? {
          occurredAt: next.occurredAt,
          id: next.id,
        }
      : null,
  };
}

import type { OrionTimelineCategory, OrionTimelineContextMaps, OrionTimelineItem, OrionTimelineSeverity } from "./timeline-types";

type WorkflowEventRecord = {
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

export type LegacyTimelineSource = "workflow" | "workforce_events" | "change_order_activity" | "invoice_payment_history";

export type TimelineRawRecord = {
  id: string;
  source: LegacyTimelineSource;
  companyId: string;
  eventType: string;
  sourceModule: string;
  entityType: string;
  entityId: string;
  actorProfileId: string | null;
  occurredAt: string;
  correlationId: string | null;
  causationId: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type EventDescriptor = {
  category: OrionTimelineCategory;
  severity: OrionTimelineSeverity;
  titleKey: string;
  summaryKey: string;
};

const EVENT_DESCRIPTORS: Record<string, EventDescriptor> = {
  "customer.created": { category: "customers", severity: "info", titleKey: "orion.timeline.event.customerCreated.title", summaryKey: "orion.timeline.event.customerCreated.summary" },
  "estimate.created": { category: "sales", severity: "info", titleKey: "orion.timeline.event.estimateCreated.title", summaryKey: "orion.timeline.event.estimateCreated.summary" },
  "estimate.sent": { category: "sales", severity: "attention", titleKey: "orion.timeline.event.estimateSent.title", summaryKey: "orion.timeline.event.estimateSent.summary" },
  "estimate.viewed": { category: "sales", severity: "info", titleKey: "orion.timeline.event.estimateViewed.title", summaryKey: "orion.timeline.event.estimateViewed.summary" },
  "estimate.approved": { category: "sales", severity: "success", titleKey: "orion.timeline.event.estimateApproved.title", summaryKey: "orion.timeline.event.estimateApproved.summary" },
  "estimate.declined": { category: "sales", severity: "attention", titleKey: "orion.timeline.event.estimateDeclined.title", summaryKey: "orion.timeline.event.estimateDeclined.summary" },
  "estimate.request_changes": { category: "sales", severity: "attention", titleKey: "orion.timeline.event.estimateRequestedChanges.title", summaryKey: "orion.timeline.event.estimateRequestedChanges.summary" },
  "project.created": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectCreated.title", summaryKey: "orion.timeline.event.projectCreated.summary" },
  "invoice.created": { category: "finance", severity: "info", titleKey: "orion.timeline.event.invoiceCreated.title", summaryKey: "orion.timeline.event.invoiceCreated.summary" },
  "invoice.sent": { category: "finance", severity: "attention", titleKey: "orion.timeline.event.invoiceSent.title", summaryKey: "orion.timeline.event.invoiceSent.summary" },
  "invoice.paid": { category: "finance", severity: "success", titleKey: "orion.timeline.event.invoicePaid.title", summaryKey: "orion.timeline.event.invoicePaid.summary" },
  "deposit.received": { category: "finance", severity: "success", titleKey: "orion.timeline.event.depositReceived.title", summaryKey: "orion.timeline.event.depositReceived.summary" },
  "employee.created": { category: "workforce", severity: "info", titleKey: "orion.timeline.event.employeeCreated.title", summaryKey: "orion.timeline.event.employeeCreated.summary" },
  "employee.updated": { category: "workforce", severity: "info", titleKey: "orion.timeline.event.employeeUpdated.title", summaryKey: "orion.timeline.event.employeeUpdated.summary" },
  "crew.created": { category: "workforce", severity: "info", titleKey: "orion.timeline.event.crewCreated.title", summaryKey: "orion.timeline.event.crewCreated.summary" },
  "crew.updated": { category: "workforce", severity: "info", titleKey: "orion.timeline.event.crewUpdated.title", summaryKey: "orion.timeline.event.crewUpdated.summary" },
  "crew.assigned": { category: "scheduling", severity: "info", titleKey: "orion.timeline.event.crewAssigned.title", summaryKey: "orion.timeline.event.crewAssigned.summary" },
  "change_order.created": { category: "projects", severity: "info", titleKey: "orion.timeline.event.changeOrderCreated.title", summaryKey: "orion.timeline.event.changeOrderCreated.summary" },
  "daily_report.created": { category: "field", severity: "info", titleKey: "orion.timeline.event.dailyReportCreated.title", summaryKey: "orion.timeline.event.dailyReportCreated.summary" },
  "task.completed": { category: "scheduling", severity: "success", titleKey: "orion.timeline.event.taskCompleted.title", summaryKey: "orion.timeline.event.taskCompleted.summary" },
  "workflow.executed": { category: "system", severity: "info", titleKey: "orion.timeline.event.workflowExecuted.title", summaryKey: "orion.timeline.event.workflowExecuted.summary" },
};

const BLOCKED_PAYLOAD_KEYS = new Set([
  "internal_notes",
  "notes",
  "legal_evidence",
  "signature_hash",
  "token",
  "token_hash",
  "agreement_hash",
  "margin",
  "cost_breakdown",
  "unit_cost",
  "direct_cost",
]);

function normalizeName(firstName: string | null | undefined, lastName: string | null | undefined, fallback: string) {
  const fullName = [firstName?.trim() || "", lastName?.trim() || ""].filter(Boolean).join(" ");
  return fullName || fallback;
}

function getCustomerLabel(customer: (OrionTimelineContextMaps["customerById"] extends Map<string, infer T> ? T : never) | null) {
  if (!customer) {
    return "Customer";
  }

  const companyName = customer.companyName?.trim() || "";
  const firstName = customer.firstName?.trim() || "";
  const lastName = customer.lastName?.trim() || "";
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");

  if (customer.customerType?.trim().toLowerCase() === "commercial" && companyName) {
    return companyName;
  }

  return fallbackName || companyName || "Customer";
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function sanitizeDisplayData(payload: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const normalized = key.trim().toLowerCase();
    if (BLOCKED_PAYLOAD_KEYS.has(normalized) || normalized.includes("token") || normalized.includes("hash") || normalized.includes("signature")) {
      continue;
    }

    if (
      normalized.includes("internal")
      || normalized.includes("margin")
      || normalized.includes("cost")
      || normalized.includes("legal")
    ) {
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

function descriptorFor(eventType: string): EventDescriptor {
  return EVENT_DESCRIPTORS[eventType] || {
    category: "system",
    severity: "info",
    titleKey: "orion.timeline.event.generic.title",
    summaryKey: "orion.timeline.event.generic.summary",
  };
}

function resolveEntityContext(record: TimelineRawRecord, context: OrionTimelineContextMaps) {
  const payload = toRecord(record.payload);
  const entityType = record.entityType;
  const entityId = record.entityId;

  let projectId = readString(payload, "project_id");
  let customerId = readString(payload, "customer_id");

  if (entityType === "project") {
    projectId = entityId;
  }

  if (entityType === "customer") {
    customerId = entityId;
  }

  if (entityType === "estimate") {
    const estimate = context.estimateById.get(entityId);
    projectId = projectId || estimate?.projectId || null;
    customerId = customerId || estimate?.customerId || null;
  }

  if (entityType === "invoice") {
    const invoice = context.invoiceById.get(entityId);
    projectId = projectId || invoice?.projectId || null;
    customerId = customerId || invoice?.customerId || null;
  }

  if (entityType === "change_order") {
    const changeOrder = context.changeOrderById.get(entityId);
    projectId = projectId || changeOrder?.projectId || null;
    customerId = customerId || changeOrder?.customerId || null;
  }

  const projectName = projectId ? (context.projectById.get(projectId)?.name || null) : null;
  const customerName = customerId ? getCustomerLabel(context.customerById.get(customerId) || null) : null;
  const actor = record.actorProfileId ? context.profileById.get(record.actorProfileId) : null;
  const actorName = actor ? normalizeName(actor.firstName, actor.lastName, "Team member") : null;

  return {
    payload,
    projectId: projectId || null,
    customerId: customerId || null,
    projectName,
    customerName,
    actorName,
  };
}

function summaryFor(record: TimelineRawRecord, context: ReturnType<typeof resolveEntityContext>) {
  const payload = context.payload;

  const estimateNumber = readString(payload, "estimate_number") || context.payload.estimateNumber as string | undefined || null;
  const invoiceNumber = readString(payload, "invoice_number") || null;
  const projectNumberOrName = readString(payload, "project_number") || context.projectName || null;

  switch (record.eventType) {
    case "customer.created":
      return `${context.customerName || "A customer"} was added to B.O.S.`;
    case "estimate.created":
      return `Estimate ${estimateNumber || "record"} was created${context.customerName ? ` for ${context.customerName}` : "."}`;
    case "estimate.sent":
      return `Estimate ${estimateNumber || "record"} was sent${context.customerName ? ` to ${context.customerName}` : "."}`;
    case "estimate.viewed":
      return `${context.customerName || "A customer"} viewed Estimate ${estimateNumber || "record"}.`;
    case "estimate.approved":
      return `${context.customerName || "A customer"} approved Estimate ${estimateNumber || "record"}.`;
    case "project.created":
      return `Project ${projectNumberOrName || "record"} was created.`;
    case "invoice.created":
      return `Invoice ${invoiceNumber || "record"} was created${context.customerName ? ` for ${context.customerName}` : "."}`;
    case "invoice.sent":
      return `Invoice ${invoiceNumber || "record"} was sent.`;
    case "invoice.paid":
      return `Invoice ${invoiceNumber || "record"} was paid.`;
    case "crew.created":
      return "A crew record was created.";
    case "crew.assigned":
      return "A crew assignment was updated.";
    case "employee.created":
      return "An employee record was created.";
    case "change_order.created":
      return "A change order was created.";
    case "daily_report.created":
      return "A daily report was created.";
    case "task.completed":
      return "A task was completed.";
    case "workflow.executed":
      return "A workflow completed successfully.";
    default:
      return "An activity event was recorded.";
  }
}

function titleFor(eventType: string) {
  switch (eventType) {
    case "customer.created":
      return "Customer Created";
    case "estimate.created":
      return "Estimate Created";
    case "estimate.sent":
      return "Estimate Sent";
    case "estimate.viewed":
      return "Estimate Viewed";
    case "estimate.approved":
      return "Estimate Approved";
    case "estimate.declined":
      return "Estimate Declined";
    case "estimate.request_changes":
      return "Estimate Change Requested";
    case "project.created":
      return "Project Created";
    case "invoice.created":
      return "Invoice Created";
    case "invoice.sent":
      return "Invoice Sent";
    case "invoice.paid":
      return "Payment Received";
    case "employee.created":
      return "Employee Created";
    case "crew.created":
      return "Crew Created";
    case "crew.assigned":
      return "Crew Assigned";
    case "change_order.created":
      return "Change Order Created";
    case "daily_report.created":
      return "Daily Report Created";
    case "task.completed":
      return "Task Completed";
    case "workflow.executed":
      return "Workflow Completed";
    default:
      return "Activity Recorded";
  }
}

function hrefFor(entityType: string, entityId: string) {
  if (!entityId) {
    return null;
  }

  switch (entityType) {
    case "customer":
      return `/customers/${entityId}`;
    case "estimate":
      return `/estimates/${entityId}`;
    case "project":
      return `/projects/${entityId}`;
    case "invoice":
      return `/invoices/${entityId}`;
    case "employee":
      return `/employees/${entityId}`;
    case "crew":
      return `/crews/${entityId}`;
    case "change_order":
      return `/change-orders/${entityId}`;
    case "daily_report":
      return `/daily-reports/${entityId}`;
    default:
      return null;
  }
}

export function mapWorkflowEventRow(row: WorkflowEventRecord): TimelineRawRecord {
  return {
    id: row.id,
    source: "workflow",
    companyId: row.company_id,
    eventType: row.event_type,
    sourceModule: row.source_module || "system",
    entityType: row.reference_entity,
    entityId: row.reference_id,
    actorProfileId: row.actor_profile_id,
    occurredAt: row.occurred_at,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    payload: toRecord(row.payload),
    metadata: toRecord(row.metadata),
  };
}

export function mapTimelineItem(record: TimelineRawRecord, contextMaps: OrionTimelineContextMaps): OrionTimelineItem {
  const descriptor = descriptorFor(record.eventType);
  const context = resolveEntityContext(record, contextMaps);
  const title = titleFor(record.eventType);
  const summary = summaryFor(record, context);
  const displayData = sanitizeDisplayData(context.payload);

  if (context.projectName) {
    displayData.project_name = context.projectName;
  }

  if (context.customerName) {
    displayData.customer_name = context.customerName;
  }

  if (context.actorName) {
    displayData.actor_name = context.actorName;
  }

  return {
    id: `${record.source}:${record.id}`,
    sourceEventId: record.id,
    companyId: record.companyId,
    eventType: record.eventType,
    sourceModule: record.sourceModule,
    entityType: record.entityType,
    entityId: record.entityId,
    projectId: context.projectId,
    customerId: context.customerId,
    actorProfileId: record.actorProfileId,
    category: descriptor.category,
    severity: descriptor.severity,
    title,
    summary,
    href: hrefFor(record.entityType, record.entityId),
    occurredAt: record.occurredAt,
    correlationId: record.correlationId,
    causationId: record.causationId,
    displayData,
    titleKey: descriptor.titleKey,
    summaryKey: descriptor.summaryKey,
    actorName: context.actorName,
    projectName: context.projectName,
    customerName: context.customerName,
  };
}

export function timelineDedupeKey(item: OrionTimelineItem) {
  const occurredMinute = item.occurredAt.slice(0, 16);
  return [item.eventType, item.entityType, item.entityId, item.actorProfileId || "", occurredMinute].join("|");
}

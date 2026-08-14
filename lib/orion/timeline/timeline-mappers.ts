import type { OrionTimelineCategory, OrionTimelineContextMaps, OrionTimelineItem, OrionTimelineSeverity } from "./timeline-types";

type WorkflowEventRecord = {
  id: string;
  company_id: string;
  event_type: string;
  reference_entity: string;
  reference_id: string | null;
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
  "customer.updated": { category: "customers", severity: "info", titleKey: "orion.timeline.event.customerUpdated.title", summaryKey: "orion.timeline.event.customerUpdated.summary" },
  "customer.archived": { category: "customers", severity: "attention", titleKey: "orion.timeline.event.customerArchived.title", summaryKey: "orion.timeline.event.customerArchived.summary" },
  "customer.restored": { category: "customers", severity: "success", titleKey: "orion.timeline.event.customerRestored.title", summaryKey: "orion.timeline.event.customerRestored.summary" },
  "customer.converted": { category: "customers", severity: "success", titleKey: "orion.timeline.event.customerConverted.title", summaryKey: "orion.timeline.event.customerConverted.summary" },
  "estimate.created": { category: "sales", severity: "info", titleKey: "orion.timeline.event.estimateCreated.title", summaryKey: "orion.timeline.event.estimateCreated.summary" },
  "estimate.updated": { category: "sales", severity: "info", titleKey: "orion.timeline.event.estimateUpdated.title", summaryKey: "orion.timeline.event.estimateUpdated.summary" },
  "estimate.sent": { category: "sales", severity: "attention", titleKey: "orion.timeline.event.estimateSent.title", summaryKey: "orion.timeline.event.estimateSent.summary" },
  "estimate.viewed": { category: "sales", severity: "info", titleKey: "orion.timeline.event.estimateViewed.title", summaryKey: "orion.timeline.event.estimateViewed.summary" },
  "estimate.reminder_sent": { category: "sales", severity: "attention", titleKey: "orion.timeline.event.estimateReminderSent.title", summaryKey: "orion.timeline.event.estimateReminderSent.summary" },
  "estimate.approved": { category: "sales", severity: "success", titleKey: "orion.timeline.event.estimateApproved.title", summaryKey: "orion.timeline.event.estimateApproved.summary" },
  "estimate.declined": { category: "sales", severity: "attention", titleKey: "orion.timeline.event.estimateDeclined.title", summaryKey: "orion.timeline.event.estimateDeclined.summary" },
  "estimate.expired": { category: "sales", severity: "attention", titleKey: "orion.timeline.event.estimateExpired.title", summaryKey: "orion.timeline.event.estimateExpired.summary" },
  "estimate.converted": { category: "sales", severity: "success", titleKey: "orion.timeline.event.estimateConverted.title", summaryKey: "orion.timeline.event.estimateConverted.summary" },
  "estimate.deposit_requested": { category: "sales", severity: "attention", titleKey: "orion.timeline.event.estimateDepositRequested.title", summaryKey: "orion.timeline.event.estimateDepositRequested.summary" },
  "estimate.deposit_received": { category: "sales", severity: "success", titleKey: "orion.timeline.event.estimateDepositReceived.title", summaryKey: "orion.timeline.event.estimateDepositReceived.summary" },
  "estimate.request_changes": { category: "sales", severity: "attention", titleKey: "orion.timeline.event.estimateRequestedChanges.title", summaryKey: "orion.timeline.event.estimateRequestedChanges.summary" },
  "project.created": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectCreated.title", summaryKey: "orion.timeline.event.projectCreated.summary" },
  "project.updated": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "project.started": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectStarted.title", summaryKey: "orion.timeline.event.projectStarted.summary" },
  "project.status_changed": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectStatusChanged.title", summaryKey: "orion.timeline.event.projectStatusChanged.summary" },
  "project.completed": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectCompleted.title", summaryKey: "orion.timeline.event.projectCompleted.summary" },
  "project.archived": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectArchived.title", summaryKey: "orion.timeline.event.projectArchived.summary" },
  "project.closeout_started": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "project.closeout_blocked": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "project.walkthrough_completed": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "project.handover_completed": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "project.health_changed": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectHealthChanged.title", summaryKey: "orion.timeline.event.projectHealthChanged.summary" },
  "project.workspace_bootstrapped": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "invoice.created": { category: "finance", severity: "info", titleKey: "orion.timeline.event.invoiceCreated.title", summaryKey: "orion.timeline.event.invoiceCreated.summary" },
  "invoice.sent": { category: "finance", severity: "attention", titleKey: "orion.timeline.event.invoiceSent.title", summaryKey: "orion.timeline.event.invoiceSent.summary" },
  "invoice.viewed": { category: "finance", severity: "info", titleKey: "orion.timeline.event.invoiceViewed.title", summaryKey: "orion.timeline.event.invoiceViewed.summary" },
  "invoice.paid": { category: "finance", severity: "success", titleKey: "orion.timeline.event.invoicePaid.title", summaryKey: "orion.timeline.event.invoicePaid.summary" },
  "invoice.partial_payment": { category: "finance", severity: "attention", titleKey: "orion.timeline.event.invoicePartialPayment.title", summaryKey: "orion.timeline.event.invoicePartialPayment.summary" },
  "invoice.overdue": { category: "finance", severity: "attention", titleKey: "orion.timeline.event.invoiceOverdue.title", summaryKey: "orion.timeline.event.invoiceOverdue.summary" },
  "invoice.cancelled": { category: "finance", severity: "attention", titleKey: "orion.timeline.event.invoiceCancelled.title", summaryKey: "orion.timeline.event.invoiceCancelled.summary" },
  "payment.received": { category: "finance", severity: "success", titleKey: "orion.timeline.event.paymentReceived.title", summaryKey: "orion.timeline.event.paymentReceived.summary" },
  "deposit.received": { category: "finance", severity: "success", titleKey: "orion.timeline.event.depositReceived.title", summaryKey: "orion.timeline.event.depositReceived.summary" },
  "refund.issued": { category: "finance", severity: "attention", titleKey: "orion.timeline.event.refundIssued.title", summaryKey: "orion.timeline.event.refundIssued.summary" },
  "employee.created": { category: "workforce", severity: "info", titleKey: "orion.timeline.event.employeeCreated.title", summaryKey: "orion.timeline.event.employeeCreated.summary" },
  "employee.updated": { category: "workforce", severity: "info", titleKey: "orion.timeline.event.employeeUpdated.title", summaryKey: "orion.timeline.event.employeeUpdated.summary" },
  "employee.archived": { category: "workforce", severity: "attention", titleKey: "orion.timeline.event.employeeArchived.title", summaryKey: "orion.timeline.event.employeeArchived.summary" },
  "employee.restored": { category: "workforce", severity: "success", titleKey: "orion.timeline.event.employeeRestored.title", summaryKey: "orion.timeline.event.employeeRestored.summary" },
  "crew.created": { category: "workforce", severity: "info", titleKey: "orion.timeline.event.crewCreated.title", summaryKey: "orion.timeline.event.crewCreated.summary" },
  "crew.updated": { category: "workforce", severity: "info", titleKey: "orion.timeline.event.crewUpdated.title", summaryKey: "orion.timeline.event.crewUpdated.summary" },
  "crew.assigned": { category: "scheduling", severity: "info", titleKey: "orion.timeline.event.crewAssigned.title", summaryKey: "orion.timeline.event.crewAssigned.summary" },
  "crew.unassigned": { category: "scheduling", severity: "attention", titleKey: "orion.timeline.event.crewUnassigned.title", summaryKey: "orion.timeline.event.crewUnassigned.summary" },
  "crew.completed": { category: "scheduling", severity: "success", titleKey: "orion.timeline.event.crewCompleted.title", summaryKey: "orion.timeline.event.crewCompleted.summary" },
  "change_order.created": { category: "projects", severity: "info", titleKey: "orion.timeline.event.changeOrderCreated.title", summaryKey: "orion.timeline.event.changeOrderCreated.summary" },
  "change_order.sent": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.changeOrderSent.title", summaryKey: "orion.timeline.event.changeOrderSent.summary" },
  "change_order.approved": { category: "projects", severity: "success", titleKey: "orion.timeline.event.changeOrderApproved.title", summaryKey: "orion.timeline.event.changeOrderApproved.summary" },
  "change_order.rejected": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.changeOrderRejected.title", summaryKey: "orion.timeline.event.changeOrderRejected.summary" },
  "change_order.completed": { category: "projects", severity: "success", titleKey: "orion.timeline.event.changeOrderCompleted.title", summaryKey: "orion.timeline.event.changeOrderCompleted.summary" },
  "daily_report.created": { category: "field", severity: "info", titleKey: "orion.timeline.event.dailyReportCreated.title", summaryKey: "orion.timeline.event.dailyReportCreated.summary" },
  "daily_report.updated": { category: "field", severity: "info", titleKey: "orion.timeline.event.dailyReportUpdated.title", summaryKey: "orion.timeline.event.dailyReportUpdated.summary" },
  "inspection.created": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "inspection.scheduled": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "inspection.rescheduled": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "inspection.started": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "inspection.passed": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "inspection.failed": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "inspection.cancelled": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "inspection.reinspection_required": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.created": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.required": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.not_required": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.submitted": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.approved": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.issued": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.rejected": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.expired": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.renewal_required": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.renewed": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "permit.closed": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "punch_item.created": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "punch_item.completed": { category: "projects", severity: "success", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "punch_item.reopened": { category: "projects", severity: "attention", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "warranty.started": { category: "projects", severity: "info", titleKey: "orion.timeline.event.projectUpdated.title", summaryKey: "orion.timeline.event.projectUpdated.summary" },
  "customer_update.drafted": { category: "customers", severity: "info", titleKey: "orion.timeline.event.customerUpdated.title", summaryKey: "orion.timeline.event.customerUpdated.summary" },
  "customer_update.sent": { category: "customers", severity: "attention", titleKey: "orion.timeline.event.customerUpdated.title", summaryKey: "orion.timeline.event.customerUpdated.summary" },
  "customer_update.delivered": { category: "customers", severity: "success", titleKey: "orion.timeline.event.customerUpdated.title", summaryKey: "orion.timeline.event.customerUpdated.summary" },
  "customer_update.failed": { category: "customers", severity: "attention", titleKey: "orion.timeline.event.customerUpdated.title", summaryKey: "orion.timeline.event.customerUpdated.summary" },
  "customer_update.logged": { category: "customers", severity: "info", titleKey: "orion.timeline.event.customerUpdated.title", summaryKey: "orion.timeline.event.customerUpdated.summary" },
  "customer_message.received": { category: "customers", severity: "info", titleKey: "orion.timeline.event.customerUpdated.title", summaryKey: "orion.timeline.event.customerUpdated.summary" },
  "task.created": { category: "scheduling", severity: "info", titleKey: "orion.timeline.event.taskCreated.title", summaryKey: "orion.timeline.event.taskCreated.summary" },
  "task.started": { category: "scheduling", severity: "info", titleKey: "orion.timeline.event.taskStarted.title", summaryKey: "orion.timeline.event.taskStarted.summary" },
  "task.completed": { category: "scheduling", severity: "success", titleKey: "orion.timeline.event.taskCompleted.title", summaryKey: "orion.timeline.event.taskCompleted.summary" },
  "task.reopened": { category: "scheduling", severity: "attention", titleKey: "orion.timeline.event.taskReopened.title", summaryKey: "orion.timeline.event.taskReopened.summary" },
  "schedule.created": { category: "scheduling", severity: "info", titleKey: "orion.timeline.event.scheduleCreated.title", summaryKey: "orion.timeline.event.scheduleCreated.summary" },
  "schedule.updated": { category: "scheduling", severity: "info", titleKey: "orion.timeline.event.scheduleUpdated.title", summaryKey: "orion.timeline.event.scheduleUpdated.summary" },
  "schedule.cancelled": { category: "scheduling", severity: "attention", titleKey: "orion.timeline.event.scheduleCancelled.title", summaryKey: "orion.timeline.event.scheduleCancelled.summary" },
  "document.uploaded": { category: "field", severity: "info", titleKey: "orion.timeline.event.documentUploaded.title", summaryKey: "orion.timeline.event.documentUploaded.summary" },
  "document.deleted": { category: "field", severity: "attention", titleKey: "orion.timeline.event.documentDeleted.title", summaryKey: "orion.timeline.event.documentDeleted.summary" },
  "document.signed": { category: "field", severity: "success", titleKey: "orion.timeline.event.documentSigned.title", summaryKey: "orion.timeline.event.documentSigned.summary" },
  "workflow.executed": { category: "system", severity: "info", titleKey: "orion.timeline.event.workflowExecuted.title", summaryKey: "orion.timeline.event.workflowExecuted.summary" },
  "decision.created": { category: "system", severity: "attention", titleKey: "orion.timeline.event.decisionCreated.title", summaryKey: "orion.timeline.event.decisionCreated.summary" },
  "decision.acknowledged": { category: "system", severity: "info", titleKey: "orion.timeline.event.decisionAcknowledged.title", summaryKey: "orion.timeline.event.decisionAcknowledged.summary" },
  "decision.resolved": { category: "system", severity: "success", titleKey: "orion.timeline.event.decisionResolved.title", summaryKey: "orion.timeline.event.decisionResolved.summary" },
  "decision.dismissed": { category: "system", severity: "attention", titleKey: "orion.timeline.event.decisionDismissed.title", summaryKey: "orion.timeline.event.decisionDismissed.summary" },
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
    case "project.workspace_bootstrapped":
      return "Project workspace operating system was initialized from the approved estimate.";
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
    case "inspection.created":
      return "An inspection record was created.";
    case "inspection.scheduled":
      return "An inspection was scheduled.";
    case "inspection.rescheduled":
      return "An inspection was rescheduled.";
    case "inspection.passed":
      return "An inspection passed.";
    case "inspection.failed":
      return "An inspection failed and needs follow-up.";
    case "inspection.reinspection_required":
      return "A reinspection was requested.";
    case "permit.created":
      return "A permit requirement was recorded.";
    case "permit.submitted":
      return "A permit was submitted for review.";
    case "permit.approved":
      return "A permit was approved.";
    case "permit.issued":
      return "A permit was issued.";
    case "permit.rejected":
      return "A permit was rejected and needs correction.";
    case "permit.expired":
      return "A permit has expired.";
    case "permit.renewed":
      return "A permit was renewed.";
    case "permit.closed":
      return "A permit was closed.";
    case "project.closeout_started":
      return "Project closeout was started.";
    case "project.closeout_blocked":
      return "Project closeout is blocked and requires action.";
    case "project.walkthrough_completed":
      return "Customer walkthrough was completed.";
    case "project.handover_completed":
      return "Project handover was completed.";
    case "punch_item.created":
      return "A punch item was added to closeout.";
    case "punch_item.completed":
      return "A punch item was completed.";
    case "punch_item.reopened":
      return "A punch item was reopened.";
    case "warranty.started":
      return "Project warranty period has started.";
    case "customer_update.drafted":
      return "A customer update draft was created.";
    case "customer_update.sent":
      return "A customer update was sent.";
    case "customer_update.delivered":
      return "A customer update was delivered.";
    case "customer_update.failed":
      return "A customer update failed to send.";
    case "customer_update.logged":
      return "A customer communication note was logged.";
    case "workflow.executed":
      {
        const commandId = readString(payload, "command_id") || "workflow";
        const success = payload.success;
        const failure = readString(payload, "failure");

        if (success === false) {
          return `Command ${commandId} failed${failure ? `: ${failure}` : "."}`;
        }

        return `Command ${commandId} executed successfully.`;
      }
    case "decision.created":
      return "A new decision recommendation needs attention.";
    case "decision.acknowledged":
      return "A decision recommendation was acknowledged.";
    case "decision.resolved":
      return "A decision recommendation was resolved.";
    case "decision.dismissed":
      return "A decision recommendation was dismissed.";
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
    case "project.workspace_bootstrapped":
      return "Project Workspace Bootstrapped";
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
    case "inspection.created":
      return "Inspection Created";
    case "inspection.scheduled":
      return "Inspection Scheduled";
    case "inspection.rescheduled":
      return "Inspection Rescheduled";
    case "inspection.passed":
      return "Inspection Passed";
    case "inspection.failed":
      return "Inspection Failed";
    case "inspection.reinspection_required":
      return "Reinspection Required";
    case "permit.created":
      return "Permit Created";
    case "permit.submitted":
      return "Permit Submitted";
    case "permit.approved":
      return "Permit Approved";
    case "permit.issued":
      return "Permit Issued";
    case "permit.rejected":
      return "Permit Rejected";
    case "permit.expired":
      return "Permit Expired";
    case "permit.renewed":
      return "Permit Renewed";
    case "permit.closed":
      return "Permit Closed";
    case "project.closeout_started":
      return "Closeout Started";
    case "project.closeout_blocked":
      return "Closeout Blocked";
    case "project.walkthrough_completed":
      return "Walkthrough Completed";
    case "project.handover_completed":
      return "Handover Completed";
    case "punch_item.created":
      return "Punch Item Created";
    case "punch_item.completed":
      return "Punch Item Completed";
    case "punch_item.reopened":
      return "Punch Item Reopened";
    case "warranty.started":
      return "Warranty Started";
    case "customer_update.drafted":
      return "Customer Update Drafted";
    case "customer_update.sent":
      return "Customer Update Sent";
    case "customer_update.delivered":
      return "Customer Update Delivered";
    case "customer_update.failed":
      return "Customer Update Failed";
    case "customer_update.logged":
      return "Customer Update Logged";
    case "workflow.executed":
      return "Workflow Completed";
    case "decision.created":
      return "Decision Created";
    case "decision.acknowledged":
      return "Decision Acknowledged";
    case "decision.resolved":
      return "Decision Resolved";
    case "decision.dismissed":
      return "Decision Dismissed";
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
    case "decision":
      return "/dashboard";
    case "inspection":
    case "permit":
    case "punch_item":
    case "warranty":
    case "communication":
      return "/projects";
    default:
      return null;
  }
}

export function mapWorkflowEventRow(row: WorkflowEventRecord): TimelineRawRecord {
  const payload = toRecord(row.payload);
  const payloadEntityId = readString(payload, "entity_id") || readString(payload, "command_id") || "";

  return {
    id: row.id,
    source: "workflow",
    companyId: row.company_id,
    eventType: row.event_type,
    sourceModule: row.source_module || "system",
    entityType: row.reference_entity,
    entityId: row.reference_id || payloadEntityId,
    actorProfileId: row.actor_profile_id,
    occurredAt: row.occurred_at,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    payload,
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

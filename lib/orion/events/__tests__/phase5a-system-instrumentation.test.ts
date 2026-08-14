import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ORION_EVENT_TYPES,
  createOrionEventPublisher,
  type OrionEventInput,
  type OrionEventRecord,
} from "../index";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function read(pathParts: string[]) {
  return readFileSync(resolve(process.cwd(), ...pathParts), "utf8");
}

function baseInput(overrides: Partial<OrionEventInput> = {}): OrionEventInput {
  return {
    company_id: "company-phase5a",
    actor_profile_id: "profile-phase5a",
    event_type: "project.updated",
    aggregate_type: "project",
    aggregate_id: "project-1",
    source_module: "projects",
    payload: {
      deep_link: "/projects/project-1",
    },
    metadata: {
      event_category: "projects",
      event_severity: "info",
      deep_link: "/projects/project-1",
    },
    ...overrides,
  };
}

function inMemoryStore() {
  const records: OrionEventRecord[] = [];

  return {
    get records() {
      return records;
    },
    async ensureActorScope() {
      return;
    },
    async findByIdempotency(companyId: string, eventType: string, idempotencyKey: string) {
      return records.find((record) => record.company_id === companyId && record.event_type === eventType && record.idempotency_key === idempotencyKey) || null;
    },
    async append(input: OrionEventInput & { idempotency_key: string; event_id?: string }) {
      const record: OrionEventRecord = {
        event_id: input.event_id || `wf-${records.length + 1}`,
        company_id: input.company_id,
        workspace_id: input.workspace_id || null,
        actor_profile_id: input.actor_profile_id,
        event_type: input.event_type,
        aggregate_type: input.aggregate_type,
        aggregate_id: input.aggregate_id,
        occurred_at: input.occurred_at || new Date().toISOString(),
        version: 1,
        source_module: input.source_module,
        payload: input.payload,
        metadata: input.metadata || {},
        correlation_id: input.correlation_id || null,
        causation_id: input.causation_id || null,
        idempotency_key: input.idempotency_key,
      };

      records.push(record);
      return record;
    },
  };
}

async function main() {
  await test("1. phase 5A Orion event catalog includes required business events", () => {
    const required = [
      "customer.created",
      "customer.updated",
      "customer.archived",
      "customer.restored",
      "customer.converted",
      "estimate.created",
      "estimate.updated",
      "estimate.sent",
      "estimate.viewed",
      "estimate.reminder_sent",
      "estimate.approved",
      "estimate.declined",
      "estimate.expired",
      "estimate.converted",
      "estimate.deposit_requested",
      "estimate.deposit_received",
      "project.created",
      "project.updated",
      "project.started",
      "project.status_changed",
      "project.completed",
      "project.archived",
      "project.health_changed",
      "invoice.created",
      "invoice.sent",
      "invoice.viewed",
      "invoice.paid",
      "invoice.partial_payment",
      "invoice.overdue",
      "invoice.cancelled",
      "payment.received",
      "deposit.received",
      "refund.issued",
      "change_order.created",
      "change_order.sent",
      "change_order.approved",
      "change_order.rejected",
      "change_order.completed",
      "employee.created",
      "employee.updated",
      "employee.archived",
      "employee.restored",
      "crew.created",
      "crew.updated",
      "crew.assigned",
      "crew.unassigned",
      "crew.completed",
      "task.created",
      "task.started",
      "task.completed",
      "task.reopened",
      "schedule.created",
      "schedule.updated",
      "schedule.cancelled",
      "daily_report.created",
      "daily_report.updated",
      "document.uploaded",
      "document.deleted",
      "document.signed",
    ];

    required.forEach((eventType) => {
      check(ORION_EVENT_TYPES.includes(eventType as (typeof ORION_EVENT_TYPES)[number]), `${eventType} is declared`);
    });
  });

  await test("2. module instrumentation publishes Orion events on real writes", () => {
    const files = [
      read(["app", "(app)", "customers", "new", "page.tsx"]),
      read(["app", "(app)", "customers", "[id]", "edit", "page.tsx"]),
      read(["app", "(app)", "projects", "new", "page.tsx"]),
      read(["lib", "estimates", "service.ts"]),
      read(["lib", "estimates", "workflow-service.ts"]),
      read(["lib", "invoices", "service.ts"]),
      read(["lib", "change-orders", "service.ts"]),
      read(["lib", "workforce", "workforce-event-repository.ts"]),
      read(["lib", "scheduling", "supabase-service.ts"]),
      read(["lib", "project-intelligence", "service.ts"]),
    ];

    const combined = files.join("\n");

    [
      "customer.created",
      "customer.updated",
      "project.created",
      "project.status_changed",
      "estimate.created",
      "estimate.updated",
      "estimate.expired",
      "estimate.deposit_requested",
      "estimate.converted",
      "invoice.created",
      "invoice.sent",
      "invoice.paid",
      "invoice.viewed",
      "invoice.overdue",
      "invoice.cancelled",
      "payment.received",
      "change_order.created",
      "change_order.sent",
      "change_order.approved",
      "change_order.rejected",
      "change_order.completed",
      "employee.created",
      "employee.updated",
      "employee.archived",
      "employee.restored",
      "crew.created",
      "crew.updated",
      "crew.assigned",
      "crew.unassigned",
      "schedule.created",
      "schedule.updated",
    ].forEach((eventType) => {
      check(combined.includes(eventType), `${eventType} publish path exists`);
    });
  });

  await test("3. timeline and dashboard consume Orion workflow events only", () => {
    const timelineQuery = read(["lib", "orion", "timeline", "timeline-query.ts"]);
    const dashboardLiveData = read(["lib", "dashboard", "live-data.ts"]);
    const operations = read(["lib", "operations", "command-center-service.ts"]);
    const projectIntel = read(["lib", "project-intelligence", "service.ts"]);

    check(timelineQuery.includes('from("workflow_events"'), "timeline reads workflow_events");
    check(timelineQuery.includes("includeLegacyAdapters ?? false"), "legacy adapters default disabled");
    check(dashboardLiveData.includes("includeLegacyAdapters: false"), "dashboard activity uses Orion timeline only");
    check(operations.includes("includeLegacyAdapters: false"), "operations activity uses Orion timeline only");
    check(projectIntel.includes("includeLegacyAdapters: false"), "project intelligence uses Orion timeline only");
  });

  await test("4. automation and decision engines consume real workflow events", () => {
    const workflowEngine = read(["lib", "workflows", "workflow-engine.ts"]);
    const automationContext = read(["lib", "orion", "automation", "automation-context.ts"]);
    const decisionContext = read(["lib", "orion", "decision", "decision-context.ts"]);

    check(workflowEngine.includes("runForWorkflowEventId"), "workflow events trigger automation runner");
    check(automationContext.includes('from("workflow_events"'), "automation loads workflow_events");
    check(decisionContext.includes('from("workflow_events"'), "decision context loads workflow_events");
  });

  await test("5. event metadata contract carries deterministic fields", async () => {
    const store = inMemoryStore();
    const publisher = createOrionEventPublisher({ store });

    const first = await publisher.publishEvent(baseInput({ idempotency_key: "phase5a-key" }));
    const second = await publisher.publishEvent(baseInput({ idempotency_key: "phase5a-key" }));
    const crossCompany = await publisher.publishEvent(baseInput({
      company_id: "company-phase5b",
      idempotency_key: "phase5a-key",
    }));

    check(!first.idempotent, "first event persists");
    check(second.idempotent, "duplicate idempotency key is deduped");
    check(store.records.length === 2, "idempotency is isolated by company and event type");
    check(crossCompany.event.company_id === "company-phase5b", "cross-company publish remains isolated");

    const event = first.event;
    check(Boolean(event.event_id), "event id is present");
    check(Boolean(event.company_id), "company id is present");
    check(Boolean(event.aggregate_type), "entity type is present");
    check(Boolean(event.aggregate_id), "entity id is present");
    check(Boolean(event.event_type), "event type is present");
    check(Boolean(event.actor_profile_id), "actor is present");
    check(Boolean(event.occurred_at), "timestamp is present");
    check(Boolean(event.metadata.event_severity), "severity metadata is present");
    check(Boolean(event.metadata.event_category), "category metadata is present");
    check(Boolean(event.metadata.deep_link), "deep link metadata is present");
    check(Boolean(event.idempotency_key), "idempotency key is present");
  });

  console.log(`\nPhase 5A instrumentation results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

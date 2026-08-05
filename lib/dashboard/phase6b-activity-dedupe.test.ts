import { dedupeBusinessActivityCards, suppressWorkflowExecutedFromBusinessActivity } from "./live-data";
import { queryOrionTimeline } from "@/lib/orion/timeline";
import type { OrionTimelineItem } from "@/lib/orion/timeline";

type Row = Record<string, unknown>;
type TableData = Record<string, Row[]>;

type QueryFilter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "in"; column: string; values: readonly string[] }
  | { type: "gte"; column: string; value: string }
  | { type: "lte"; column: string; value: string };

type QueryOrder = { column: string; ascending: boolean };

class MockQueryBuilder {
  private readonly tableName: string;
  private readonly db: TableData;
  private filters: QueryFilter[] = [];
  private orders: QueryOrder[] = [];
  private maxRows: number | null = null;

  constructor(tableName: string, db: TableData) {
    this.tableName = tableName;
    this.db = db;
  }

  select(columns: string) {
    void columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, values: readonly string[]) {
    this.filters.push({ type: "in", column, values });
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column: string, value: string) {
    this.filters.push({ type: "lte", column, value });
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.orders.push({ column, ascending: options.ascending });
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const data = this.execute();
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }

  private execute() {
    let rows = [...(this.db[this.tableName] || [])];

    for (const filter of this.filters) {
      rows = rows.filter((row) => {
        const value = row[filter.column];

        if (filter.type === "eq") {
          return value === filter.value;
        }

        if (filter.type === "in") {
          return typeof value === "string" && filter.values.includes(value);
        }

        if (filter.type === "gte") {
          return typeof value === "string" && value >= filter.value;
        }

        if (filter.type === "lte") {
          return typeof value === "string" && value <= filter.value;
        }

        return true;
      });
    }

    for (const order of this.orders) {
      rows.sort((left, right) => {
        const a = left[order.column];
        const b = right[order.column];
        if (a === b) {
          return 0;
        }

        if (typeof a === "string" && typeof b === "string") {
          return order.ascending ? a.localeCompare(b) : b.localeCompare(a);
        }

        return 0;
      });
    }

    if (this.maxRows !== null) {
      rows = rows.slice(0, this.maxRows);
    }

    return rows;
  }
}

class MockSupabase {
  private readonly db: TableData;

  constructor(db: TableData) {
    this.db = db;
  }

  from(table: string) {
    return new MockQueryBuilder(table, this.db);
  }
}

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

function makeBaseItem(overrides: Partial<OrionTimelineItem> = {}): OrionTimelineItem {
  return {
    id: "workflow:wf-1",
    sourceEventId: "wf-1",
    companyId: "co-1",
    eventType: "workflow.executed",
    sourceModule: "workflows",
    entityType: "workflow",
    entityId: "project.update_status",
    projectId: "proj-1",
    customerId: null,
    actorProfileId: "actor-1",
    category: "system",
    severity: "info",
    title: "Workflow Completed",
    summary: "Command project.update_status executed successfully.",
    href: "/projects/proj-1",
    occurredAt: "2026-08-04T10:00:00.000Z",
    correlationId: "corr-1",
    causationId: "corr-1",
    displayData: {
      command_id: "project.update_status",
      success: true,
    },
    titleKey: "orion.timeline.event.workflowExecuted.title",
    summaryKey: "orion.timeline.event.workflowExecuted.summary",
    actorName: "Misty",
    projectName: "Project 1",
    customerName: null,
    ...overrides,
  };
}

function makeDb(): TableData {
  return {
    workflow_events: [],
    invoice_payment_history: [],
    change_order_activity: [],
    workforce_events: [],
    estimates: [],
    invoices: [],
    change_orders: [],
    profiles: [],
    projects: [],
    customers: [],
  };
}

async function main() {
  await test("1. command + domain event dedupe to one dashboard activity", () => {
    const workflow = makeBaseItem();
    const domain = makeBaseItem({
      id: "workflow:domain-1",
      sourceEventId: "domain-1",
      eventType: "project.status_changed",
      sourceModule: "projects",
      entityType: "project",
      entityId: "proj-1",
      category: "projects",
      summary: "Project status changed.",
      title: "Project Updated",
      displayData: {},
    });

    const business = dedupeBusinessActivityCards(
      suppressWorkflowExecutedFromBusinessActivity([workflow, domain]),
    );

    check(business.length === 1, "dashboard activity shows one card for correlated command + domain event");
    check(business[0]?.eventType === "project.status_changed", "dashboard activity prefers domain event over workflow.executed");
  });

  await test("2. timeline audit retains command and domain events", async () => {
    const db = makeDb();
    db.workflow_events.push(
      {
        id: "wf-command",
        company_id: "co-1",
        event_type: "workflow.executed",
        reference_entity: "workflow",
        reference_id: "project.update_status",
        source_module: "workflows",
        actor_profile_id: "actor-1",
        occurred_at: "2026-08-04T10:00:01.000Z",
        correlation_id: "corr-a",
        causation_id: "corr-a",
        payload: { command_id: "project.update_status", success: true },
        metadata: {},
      },
      {
        id: "wf-domain",
        company_id: "co-1",
        event_type: "project.status_changed",
        reference_entity: "project",
        reference_id: "proj-1",
        source_module: "projects",
        actor_profile_id: "actor-1",
        occurred_at: "2026-08-04T10:00:02.000Z",
        correlation_id: "corr-a",
        causation_id: "corr-a",
        payload: {},
        metadata: {},
      },
    );

    const timeline = await queryOrionTimeline(new MockSupabase(db) as never, "co-1", {
      includeLegacyAdapters: false,
    });

    check(timeline.items.length === 2, "timeline keeps both command history and domain event for audit visibility");
  });

  await test("3. failed command is not business activity but remains in timeline history", async () => {
    const failed = makeBaseItem({
      displayData: { command_id: "invoice.send", success: false, failure: "Permission denied" },
      summary: "Command invoice.send failed: Permission denied",
    });

    const business = suppressWorkflowExecutedFromBusinessActivity([failed]);
    check(business.length === 0, "failed workflow command is suppressed from dashboard business activity");

    const db = makeDb();
    db.workflow_events.push({
      id: "wf-failed",
      company_id: "co-1",
      event_type: "workflow.executed",
      reference_entity: "workflow",
      reference_id: "invoice.send",
      source_module: "workflows",
      actor_profile_id: "actor-1",
      occurred_at: "2026-08-04T10:00:03.000Z",
      correlation_id: "corr-f",
      causation_id: "corr-f",
      payload: { command_id: "invoice.send", success: false, failure: "Permission denied" },
      metadata: {},
    });

    const timeline = await queryOrionTimeline(new MockSupabase(db) as never, "co-1", {
      includeLegacyAdapters: false,
    });

    check(timeline.items.length === 1 && timeline.items[0]?.eventType === "workflow.executed", "failed command remains visible in timeline/operations history");
  });

  await test("4. navigation commands do not create business activity cards", () => {
    const navigationCommand = makeBaseItem({
      displayData: { command_id: "customer.open", success: true },
      summary: "Command customer.open executed successfully.",
    });

    const business = suppressWorkflowExecutedFromBusinessActivity([navigationCommand]);
    check(business.length === 0, "navigation workflow command is suppressed from dashboard business activity");
  });

  await test("5. duplicate retries do not create duplicate business cards", () => {
    const a = makeBaseItem({ id: "workflow:domain-a", sourceEventId: "domain-a", eventType: "invoice.paid", sourceModule: "invoices", entityType: "invoice", entityId: "inv-1", category: "finance", correlationId: "corr-r", causationId: "corr-r", displayData: {} });
    const b = makeBaseItem({ id: "workflow:domain-b", sourceEventId: "domain-b", eventType: "invoice.paid", sourceModule: "invoices", entityType: "invoice", entityId: "inv-1", category: "finance", correlationId: "corr-r", causationId: "corr-r", displayData: {}, occurredAt: "2026-08-04T10:00:20.000Z" });

    const deduped = dedupeBusinessActivityCards([a, b]);
    check(deduped.length === 1, "duplicate retry events collapse to one business activity card");
  });

  await test("6. company isolation is preserved", async () => {
    const db = makeDb();
    db.workflow_events.push(
      {
        id: "wf-company-a",
        company_id: "co-a",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "proj-1",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-04T08:00:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
      {
        id: "wf-company-b",
        company_id: "co-b",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "proj-2",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-04T08:00:01.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
    );

    const timeline = await queryOrionTimeline(new MockSupabase(db) as never, "co-a", {});
    check(timeline.items.length === 1 && timeline.items[0]?.companyId === "co-a", "timeline query remains company scoped");
  });

  console.log(`\nDashboard activity dedupe results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

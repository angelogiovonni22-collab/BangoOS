import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapTimelineItem, mapWorkflowEventRow } from "../timeline-mappers";
import { queryOrionTimeline } from "../timeline-query";
import type { OrionTimelineContextMaps } from "../timeline-types";

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

  select() {
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

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function makeContext(): OrionTimelineContextMaps {
  return {
    estimateById: new Map(),
    invoiceById: new Map(),
    changeOrderById: new Map(),
    profileById: new Map(),
    projectById: new Map(),
    customerById: new Map(),
  };
}

function makeBaseDb(): TableData {
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
  await test("1. workflow_events remains the canonical Orion ledger", async () => {
    const querySource = readFileSync(join(process.cwd(), "lib/orion/timeline/timeline-query.ts"), "utf8");
    assert(querySource.includes('from("workflow_events"'), "timeline query reads workflow_events");

    const db = makeBaseDb();
    db.workflow_events.push({
      id: "wf-paid-1",
      company_id: "co-1",
      event_type: "invoice.paid",
      reference_entity: "invoice",
      reference_id: "inv-1",
      source_module: "invoices",
      actor_profile_id: "actor-1",
      occurred_at: "2026-08-01T10:15:30.000Z",
      correlation_id: null,
      causation_id: null,
      payload: {},
      metadata: {},
    });
    db.invoice_payment_history.push({
      id: "legacy-paid-1",
      company_id: "co-1",
      invoice_id: "inv-1",
      created_by: "actor-1",
      created_at: "2026-08-01T10:15:00.000Z",
      payment_date: "2026-08-01",
      amount: 10,
    });

    const result = await queryOrionTimeline(new MockSupabase(db) as never, "co-1", {
      pageSize: 20,
      includeLegacyAdapters: true,
    });

    assert(result.items.length === 1, "legacy duplicate is deduped against canonical event");
    assert(result.items[0]?.id.startsWith("workflow:"), "canonical workflow event is retained");
  });

  await test("2. no second Orion event table exists", () => {
    const schema = readFileSync(join(process.cwd(), "supabase/schema-public.sql"), "utf8").toLowerCase();
    assert(!schema.includes("orion_events"), "schema does not define orion_events");

    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260803150000_orion_event_engine_foundation.sql"), "utf8").toLowerCase();
    assert(!migration.includes("create table public.orion_events"), "orion migration does not create a second event table");
  });

  await test("3. empty ledger returns empty timeline", async () => {
    const result = await queryOrionTimeline(new MockSupabase(makeBaseDb()) as never, "co-empty", {
      includeLegacyAdapters: false,
    });
    assert(result.items.length === 0, "empty workflow ledger returns no timeline rows");
    assert(result.hasMore === false, "empty workflow ledger has no pagination remainder");
    assert(result.nextCursor === null, "empty workflow ledger cursor is null");
  });

  await test("4. title and summary mapping stays deterministic", () => {
    const raw = mapWorkflowEventRow({
      id: "wf-est-1",
      company_id: "co-1",
      event_type: "estimate.sent",
      reference_entity: "estimate",
      reference_id: "est-1",
      source_module: "estimates",
      actor_profile_id: "actor-1",
      occurred_at: "2026-08-01T09:00:00.000Z",
      correlation_id: null,
      causation_id: null,
      payload: {
        estimate_number: "EST-1001",
        customer_id: "cust-1",
      },
      metadata: {},
    });

    const context = makeContext();
    context.customerById.set("cust-1", {
      id: "cust-1",
      firstName: "Rosa",
      lastName: "Diaz",
      companyName: null,
      customerType: "residential",
    });

    const a = mapTimelineItem(raw, context);
    const b = mapTimelineItem(raw, context);

    assert(a.title === "Estimate Sent", "deterministic title for estimate.sent");
    assert(a.summary === b.summary, "summary output is deterministic for same input");
  });

  await test("5. company scoping is enforced", async () => {
    const db = makeBaseDb();
    db.workflow_events.push(
      {
        id: "wf-company-a",
        company_id: "co-a",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "p-1",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:00:00.000Z",
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
        reference_id: "p-2",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:01:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
    );

    const result = await queryOrionTimeline(new MockSupabase(db) as never, "co-a", {});
    assert(result.items.length === 1, "only events from selected company are returned");
    assert(result.items[0]?.companyId === "co-a", "returned event company matches scope");
  });

  await test("6. project filtering is enforced", async () => {
    const db = makeBaseDb();
    db.workflow_events.push(
      {
        id: "wf-p1",
        company_id: "co-1",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "project-1",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:00:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
      {
        id: "wf-p2",
        company_id: "co-1",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "project-2",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:01:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
    );

    const result = await queryOrionTimeline(new MockSupabase(db) as never, "co-1", { projectId: "project-2" });
    assert(result.items.length === 1, "project filter returns only matching project events");
    assert(result.items[0]?.projectId === "project-2", "project filter value is preserved in output");
  });

  await test("7. customer filtering is enforced", async () => {
    const db = makeBaseDb();
    db.workflow_events.push(
      {
        id: "wf-c1",
        company_id: "co-1",
        event_type: "customer.created",
        reference_entity: "customer",
        reference_id: "customer-1",
        source_module: "customers",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:00:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
      {
        id: "wf-c2",
        company_id: "co-1",
        event_type: "customer.created",
        reference_entity: "customer",
        reference_id: "customer-2",
        source_module: "customers",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:01:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
    );

    const result = await queryOrionTimeline(new MockSupabase(db) as never, "co-1", { customerId: "customer-2" });
    assert(result.items.length === 1, "customer filter returns only matching customer events");
    assert(result.items[0]?.customerId === "customer-2", "customer filter value is preserved in output");
  });

  await test("8. ordering is stable and descending", async () => {
    const db = makeBaseDb();
    db.workflow_events.push(
      {
        id: "wf-1",
        company_id: "co-1",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "p-1",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:00:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
      {
        id: "wf-3",
        company_id: "co-1",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "p-3",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:02:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
      {
        id: "wf-2",
        company_id: "co-1",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "p-2",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:01:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
    );

    const result = await queryOrionTimeline(new MockSupabase(db) as never, "co-1", { pageSize: 10 });
    assert(result.items[0]?.sourceEventId === "wf-3", "newest event appears first");
    assert(result.items[1]?.sourceEventId === "wf-2", "middle timestamp appears second");
    assert(result.items[2]?.sourceEventId === "wf-1", "oldest event appears last");
  });

  await test("9. cursor pagination is stable", async () => {
    const db = makeBaseDb();
    db.workflow_events.push(
      {
        id: "wf-a",
        company_id: "co-1",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "p-a",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:00:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
      {
        id: "wf-b",
        company_id: "co-1",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "p-b",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:01:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
      {
        id: "wf-c",
        company_id: "co-1",
        event_type: "project.created",
        reference_entity: "project",
        reference_id: "p-c",
        source_module: "projects",
        actor_profile_id: null,
        occurred_at: "2026-08-01T08:02:00.000Z",
        correlation_id: null,
        causation_id: null,
        payload: {},
        metadata: {},
      },
    );

    const supabase = new MockSupabase(db);
    const firstPage = await queryOrionTimeline(supabase as never, "co-1", { pageSize: 2 });
    assert(firstPage.items.length === 2, "first page returns requested size");
    assert(firstPage.hasMore, "first page indicates additional rows");
    assert(firstPage.nextCursor !== null, "first page returns cursor");

    const secondPage = await queryOrionTimeline(supabase as never, "co-1", {
      pageSize: 2,
      cursor: firstPage.nextCursor || undefined,
    });
    assert(secondPage.items.length === 1, "second page returns remaining row");
    assert(secondPage.items[0]?.sourceEventId === "wf-a", "second page starts after first page cursor");
  });

  await test("10. sensitive payload fields are excluded", () => {
    const raw = mapWorkflowEventRow({
      id: "wf-sensitive",
      company_id: "co-1",
      event_type: "estimate.created",
      reference_entity: "estimate",
      reference_id: "est-sensitive",
      source_module: "estimates",
      actor_profile_id: null,
      occurred_at: "2026-08-01T09:00:00.000Z",
      correlation_id: null,
      causation_id: null,
      payload: {
        estimate_number: "EST-001",
        public_note: "keep",
        internal_notes: "remove",
        token: "remove",
        signature_hash: "remove",
        cost_breakdown: { labor: 10 },
        margin: 0.2,
      },
      metadata: {},
    });

    const mapped = mapTimelineItem(raw, makeContext());
    assert(mapped.displayData.public_note === "keep", "non-sensitive payload remains present");
    assert(!("internal_notes" in mapped.displayData), "internal notes are excluded");
    assert(!("token" in mapped.displayData), "token fields are excluded");
    assert(!("signature_hash" in mapped.displayData), "hash fields are excluded");
    assert(!("cost_breakdown" in mapped.displayData), "cost fields are excluded");
    assert(!("margin" in mapped.displayData), "margin fields are excluded");
  });

  await test("11. dashboard reads live Orion timeline", () => {
    const source = readFileSync(join(process.cwd(), "lib/dashboard/live-data.ts"), "utf8");
    assert(source.includes("createOrionTimelineService"), "dashboard imports timeline service");
    assert(source.includes("listCompanyTimeline"), "dashboard requests company timeline rows");
    assert(source.includes("buildTimelineActivities"), "dashboard activity feed is timeline-based");
  });

  await test("12. operations reads live Orion timeline", () => {
    const source = readFileSync(join(process.cwd(), "lib/operations/command-center-service.ts"), "utf8");
    assert(source.includes("createOrionTimelineService"), "operations imports timeline service");
    assert(source.includes("listCompanyTimeline"), "operations requests company timeline rows");
    assert(source.includes("buildTimelineActivityFeed"), "operations activity feed is timeline-based");
  });

  await test("13. project intelligence service does not import production mock timeline data", () => {
    const source = readFileSync(join(process.cwd(), "lib/project-intelligence/service.ts"), "utf8");
    assert(!source.includes("./mock-data"), "project intelligence service does not import mock timeline source");
    assert(!source.includes("getProjectEventsMockData"), "project intelligence service does not call mock timeline event provider");
  });

  console.log(`\nPhase 3C timeline contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

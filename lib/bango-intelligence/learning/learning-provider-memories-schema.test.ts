import { SupabaseLearningProvider } from "./learning-provider";

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

type QueryCall = {
  table: string;
  select: string;
  filters: Array<["eq" | "neq" | "is" | "gte" | "lte", string, unknown]>;
};

function makeSupabaseStub(rows: Record<string, Array<Record<string, unknown>>>) {
  const calls: QueryCall[] = [];

  const client = {
    from(table: string) {
      const call: QueryCall = {
        table,
        select: "",
        filters: [],
      };
      calls.push(call);

      const builder = {
        select(columns: string) {
          // This enforces the regression: legacy columns from the previous contract are rejected.
          if (/(^|,)related_task_id(,|$)|(^|,)phase(,|$)|(^|,)content(,|$)|(^|,)source(,|$)|(^|,)is_archived(,|$)/.test(columns)) {
            throw new Error(`Legacy memory columns requested: ${columns}`);
          }

          call.select = columns;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push(["eq", column, value]);
          return builder;
        },
        neq(column: string, value: unknown) {
          call.filters.push(["neq", column, value]);
          return builder;
        },
        is(column: string, value: unknown) {
          call.filters.push(["is", column, value]);
          return builder;
        },
        gte(column: string, value: unknown) {
          call.filters.push(["gte", column, value]);
          return builder;
        },
        lte(column: string, value: unknown) {
          call.filters.push(["lte", column, value]);
          return builder;
        },
        then(onFulfilled: (value: { data: unknown; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: rows[table] ?? [], error: null }).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };

  return { client, calls };
}

async function main() {
  await test("1. learning memory query uses current bango_memories schema", async () => {
    const { client, calls } = makeSupabaseStub({
      bango_memories: [
        {
          id: "mem-1",
          company_id: "company-a",
          project_id: "project-a",
          customer_id: null,
          task_id: "task-a",
          phase_id: "phase-a",
          category: "risk",
          title: "Delivery delay",
          summary: "Steel delivery variance",
          details: {},
          recommendation_status: null,
          confidence: "high",
          status: "active",
          source_references: [{ source: "daily_report" }],
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
          archived_at: null,
        },
      ],
    });

    const provider = new SupabaseLearningProvider(client as never);
    const records = await provider.getMemories("company-a", {
      fromIso: "2026-06-01T00:00:00.000Z",
      toIso: "2026-08-31T00:00:00.000Z",
    });

    check(records.length === 1, "one memory row is returned");
    check(records[0].related_task_id === "task-a", "current task_id maps to learning related_task_id");
    check(records[0].phase === "phase-a", "current phase_id maps to learning phase");
    check(records[0].content === "Steel delivery variance", "content is derived from summary");
    check(records[0].source === "memory_reference", "source is derived from source_references");

    const call = calls[0];
    check(call.table === "bango_memories", "bango_memories table is queried");
    check(call.select.includes("task_id") && call.select.includes("phase_id") && call.select.includes("summary"), "current schema columns are selected");
    check(call.filters.some(([op, column, value]) => op === "neq" && column === "status" && value === "archived"), "archived records are filtered using status");
    check(call.filters.some(([op, column, value]) => op === "is" && column === "archived_at" && value === null), "archived records are filtered using archived_at null check");
  });

  console.log(`\nLearning provider memory-schema regression results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

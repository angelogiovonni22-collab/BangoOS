import assert from "node:assert/strict";
import { createDailyReportsService } from "./service";
import { mergePaginationFilters } from "./use-daily-reports";
import type { DailyReportFilters } from "./types";

const initialFilters: DailyReportFilters = {
  date: "",
  projectId: "all",
  superintendentId: "all",
  status: "all",
  query: "",
  sortBy: "date_desc",
  page: 1,
  pageSize: 6,
};

function makeWorkflowEventsQuery(onExecute: () => void, data: unknown[] = []) {
  const query: {
    select: (columns: string) => typeof query;
    eq: (column: string, value: unknown) => typeof query;
    in: (column: string, values: string[]) => typeof query;
    order: (column: string, options?: unknown) => typeof query;
    then: PromiseLike<{ data: unknown[]; error: null }>["then"];
  } = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    in() {
      return query;
    },
    order() {
      return query;
    },
    then(onFulfilled, onRejected) {
      onExecute();
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    },
  };

  return query;
}

async function main() {
  let passed = 0;
  let failed = 0;

  const test = async (name: string, run: () => Promise<void> | void) => {
    try {
      await run();
      passed += 1;
      console.log(`  + ${name}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  x FAIL: ${name} -> ${message}`);
    }
  };

  console.log("\nDaily Reports request-loop regression checks");

  await test("1. unchanged pagination returns same object reference", () => {
    const merged = mergePaginationFilters(initialFilters, 1, 6);
    assert.equal(merged, initialFilters);
  });

  await test("2. changed pagination returns new object with updated values", () => {
    const merged = mergePaginationFilters(initialFilters, 2, 6);
    assert.notEqual(merged, initialFilters);
    assert.equal(merged.page, 2);
    assert.equal(merged.pageSize, 6);
    assert.equal(merged.sortBy, initialFilters.sortBy);
  });

  await test("3. concurrent dashboard/list calls share workspace resolution", async () => {
    let resolveWorkspaceCalls = 0;
    let workflowEventQueryCalls = 0;

    const supabaseClient = {
      from(table: string) {
        assert.ok(["workflow_events", "projects", "profiles"].includes(table));
        return makeWorkflowEventsQuery(() => {
          if (table === "workflow_events") workflowEventQueryCalls += 1;
        });
      },
    };

    const service = createDailyReportsService({
      supabaseClient: supabaseClient as never,
      resolveWorkspace: async () => {
        resolveWorkspaceCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));

        return {
          context: {
            userId: "user-1",
            companyId: "company-1",
            role: "owner",
            companyName: "Acme",
            companySlug: "acme",
            membershipId: "membership-1",
            membershipStatus: "active",
          },
          errorMessage: null,
          errorCode: null,
        } as const;
      },
    });

    await Promise.all([
      service.getDashboard(),
      service.listReports(initialFilters),
    ]);

    assert.equal(resolveWorkspaceCalls, 1);
    assert.equal(workflowEventQueryCalls, 1);
  });

  await test("4. new refresh cycle performs one new resolution", async () => {
    let resolveWorkspaceCalls = 0;

    const service = createDailyReportsService({
      supabaseClient: {
        from() {
          return makeWorkflowEventsQuery(() => undefined);
        },
      } as never,
      resolveWorkspace: async () => {
        resolveWorkspaceCalls += 1;

        return {
          context: {
            userId: "user-1",
            companyId: "company-1",
            role: "owner",
            companyName: "Acme",
            companySlug: "acme",
            membershipId: "membership-1",
            membershipStatus: "active",
          },
          errorMessage: null,
          errorCode: null,
        } as const;
      },
    });

    await service.listReports(initialFilters);
    await service.listReports(initialFilters);

    assert.equal(resolveWorkspaceCalls, 2);
  });

  await test("5. first report has live project and supervisor choices without report history", async () => {
    const scopedTables = new Set<string>();
    const service = createDailyReportsService({
      supabaseClient: {
        from(table: string) {
          const data = table === "projects" ? [{ id: "project-1", name: "First project" }]
            : table === "profiles" ? [
              { id: "owner-1", first_name: "Company", last_name: "Owner", role: "owner" },
              { id: "super-1", first_name: "Field", last_name: "Lead", role: "superintendent" },
              { id: "customer-1", first_name: "External", last_name: "Customer", role: "customer" },
            ] : [];
          const query = makeWorkflowEventsQuery(() => undefined, data);
          query.eq = (column, value) => {
            if (column === "company_id") {
              assert.equal(value, "company-1");
              scopedTables.add(table);
            }
            return query;
          };
          return query;
        },
      } as never,
      resolveWorkspace: async () => ({
        context: { userId: "owner-1", companyId: "company-1", role: "owner", companyName: "Acme", companySlug: "acme", membershipId: "membership-1", membershipStatus: "active" },
        errorMessage: null, errorCode: null,
      } as const),
    });
    const dashboard = await service.getDashboard();
    assert.equal(dashboard.metrics.reportsCreatedToday, 0);
    assert.deepEqual(dashboard.projectOptions, [{ id: "project-1", name: "First project" }]);
    assert.deepEqual(dashboard.superintendentOptions.map((option) => option.id), ["owner-1", "super-1"]);
    assert.deepEqual([...scopedTables].sort(), ["profiles", "projects", "workflow_events"]);
  });

  console.log(`\nRequest-loop regression results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

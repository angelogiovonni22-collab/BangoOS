import assert from "node:assert/strict";
import test from "node:test";
import { createProcurementService } from "./procurement-service";

type Dependencies = NonNullable<Parameters<typeof createProcurementService>[0]>;

function fixture(failLaterReceiptPage = false) {
  const calls: Array<{ table: string; company: string; from: number; to: number }> = [];
  const client = {
    from(table: string) {
      let company = "";
      const orders: string[] = [];
      const query = {
        select() { return query; },
        eq(column: string, value: string) { assert.equal(column, "company_id"); company = value; return query; },
        order(column: string) { orders.push(column); return query; },
        async range(from: number, to: number) {
          assert.equal(company, "fixture-company");
          assert.equal(orders.at(-1), "id");
          calls.push({ table, company, from, to });
          if (failLaterReceiptPage && table === "purchase_order_receipts" && from > 0) {
            return { data: null, error: { message: "Receipt history unavailable" } };
          }
          return {
            data: Array.from({ length: 1501 }, (_, id) => ({
              id: `${table}-${id}`, name: `Name ${id}`, status: "active", display_name: `Vendor ${id}`,
              purchase_order_id: `purchase_orders-${id}`, description: `Line ${id}`,
              quantity_ordered: 1, quantity_received: 1, quantity_damaged: 0, quantity_backordered: 0,
              inventory_quantity_received: 1, received_date: "2026-10-07", created_at: "2026-10-07T00:00:00Z",
              purchase_order_receipt_reversals: id === 1500 ? [{ id: "old-reversal", reason: "Old receipt correction" }] : [],
            })).slice(from, to + 1), error: null,
          };
        },
      };
      return query;
    },
  };
  const service = createProcurementService({
    supabaseClient: client as unknown as Dependencies["supabaseClient"],
    resolveWorkspace: async () => ({ context: {
      companyId: "fixture-company", userId: "fixture-user", role: "owner", companyName: "Fixture",
      companySlug: "fixture", membershipId: "membership", membershipStatus: "active",
    }, errorMessage: null, errorCode: null }),
  });
  return { service, calls };
}

test("overview paginates all nine company datasets and retains old receipt reversal mapping", async () => {
  const { service, calls } = fixture();
  const overview = await service.loadOverview();
  for (const rows of [overview.requests, overview.purchaseOrders, overview.lineItems, overview.receipts,
    overview.vendors, overview.projects, overview.materials, overview.costCodes]) assert.equal(rows?.length, 1501);
  assert.equal(overview.receipts?.at(-1)?.reversalId, "old-reversal");
  assert.equal(overview.receipts?.at(-1)?.reversalReason, "Old receipt correction");
  assert.equal(new Set(calls.map((call) => call.table)).size, 9);
  assert.equal(calls.length, 36);
});

test("overview rejects later receipt-page errors instead of showing partial totals", async () => {
  await assert.rejects(fixture(true).service.loadOverview(), /Receipt history unavailable/);
});

function summaryFixture(failingTable?: string) {
  const calls: Array<{ table: string; from: number }> = [];
  const client = {
    from(table: string) {
      const filters = new Map<string, string>();
      const query = {
        select() { return query; },
        eq(column: string, value: string) { filters.set(column, value); return query; },
        order(column: string) { assert.equal(column, "id"); return query; },
        async range(from: number, to: number) {
          assert.equal(filters.get("company_id"), "fixture-company");
          if (table === "purchase_orders" || table === "trade_partner_assignments") {
            assert.ok(filters.get("vendor_id") === "fixture-vendor" || filters.get("project_id") === "fixture-project");
          }
          if (filters.has("project_id")) assert.equal(filters.get("project_id"), "fixture-project");
          calls.push({ table, from });
          if (table === failingTable && from > 0) return { data: null, error: { message: `${table} later page failed` } };
          return { data: Array.from({ length: 1501 }, (_, index) => ({
            id: table === "projects" && index === 1500 ? "fixture-project" : `row-${index}`, purchase_order_id: `row-${index}`, project_id: "fixture-project",
            name: "Historical project", status: "issued", total_amount: 3, total_cost: 2,
            quantity_ordered: 2, quantity_received: 1, quantity_damaged: 0,
          })).slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  };
  const service = createProcurementService({
    supabaseClient: client as unknown as Dependencies["supabaseClient"],
    resolveWorkspace: async () => ({ context: {
      companyId: "fixture-company", userId: "fixture-user", role: "owner", companyName: "Fixture",
      companySlug: "fixture", membershipId: "membership", membershipStatus: "active",
    }, errorMessage: null, errorCode: null }),
  });
  return { service, calls };
}

test("vendor summary includes all historical orders, lines, assignments and project references", async () => {
  const { service, calls } = summaryFixture();
  assert.deepEqual(await service.getVendorSummary("fixture-vendor"), {
    activePurchaseOrders: 1501, orderHistoryCount: 1501, deliveryPerformancePercent: 50,
    outstandingBalanceAmount: 4503, associatedProjects: [{ id: "fixture-project", name: "Historical project" }],
  });
  assert.equal(calls.length, 16);
  assert.equal(new Set(calls.map((call) => call.table)).size, 4);
});

test("project summary includes all historical quantities and allocated cost", async () => {
  const { service, calls } = summaryFixture();
  assert.deepEqual(await service.getProjectSummary("fixture-project"), {
    materialsOrdered: 3002, materialsReceived: 1501, outstandingOrders: 1501,
    materialCost: 3002, pendingDeliveries: 1501,
  });
  assert.equal(calls.length, 12);
});

test("summaries reject later-page errors rather than reporting incomplete totals", async () => {
  for (const table of ["purchase_orders", "purchase_order_line_items", "trade_partner_assignments", "projects"]) {
    await assert.rejects(summaryFixture(table).service.getVendorSummary("fixture-vendor"), /later page failed/);
  }
  for (const table of ["purchase_orders", "purchase_order_line_items", "project_material_allocations"]) {
    await assert.rejects(summaryFixture(table).service.getProjectSummary("fixture-project"), /later page failed/);
  }
});

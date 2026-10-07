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

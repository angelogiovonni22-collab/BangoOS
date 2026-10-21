import assert from "node:assert/strict";
import test from "node:test";
import { approveChangeOrder, rejectChangeOrder, reopenChangeOrder, saveChangeOrder, submitForApproval, voidChangeOrder } from "./service";
import type { ChangeOrderFormValues, ChangeOrderLineItemDraft } from "./types";

type Row = Record<string, unknown>;
function fixture(status = "pending_approval", archived = true, archiveOnUpdate = false) {
  const original = { id: "order", company_id: "company", status, archived_at: archived ? "2026-10-19" : null, total_amount: 30 };
  const tables: Record<string, Row[]> = {
    change_orders: [{ ...original }, { ...original, id: "foreign", company_id: "other" }],
    change_order_line_items: [{ id: "line", company_id: "company", change_order_id: "order", description: "Retained line" }],
    change_order_notes: [], change_order_activity: [], change_order_invoice_links: [],
  };
  let writes = 0;
  let attemptedUpdates = 0;
  const client = { from(table: string) {
    assert.ok(table in tables, `Unexpected table ${table}`);
    const filters: Array<(row: Row) => boolean> = [];
    let operation = "select";
    let payload: Row | Row[] = {};
    function execute(single = false) {
      if (operation === "update") {
        attemptedUpdates++;
        if (archiveOnUpdate && table === "change_orders") tables[table][0].archived_at = "2026-10-21";
      }
      let rows = tables[table].filter(row => filters.every(match => match(row)));
      if (operation !== "select") {
        if (operation !== "insert") assert.ok(filters.length >= 2, "Writes must scope company and record");
        if (operation === "update") {
          const values = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
          rows.forEach(row => Object.assign(row, values));
          writes += rows.length;
        } else if (operation === "delete") {
          tables[table] = tables[table].filter(row => !rows.includes(row));
          writes += rows.length;
        } else {
          rows = Array.isArray(payload) ? payload : [payload];
          tables[table].push(...rows);
          writes += rows.length;
        }
      }
      return { data: single ? rows[0] ?? null : rows, error: null };
    }
    const query = {
      select() { return query; },
      eq(column: string, value: unknown) { filters.push(row => row[column] === value); return query; },
      is(column: string, value: unknown) { filters.push(row => row[column] === value); return query; },
      order() { return query; },
      update(values: Row) { operation = "update"; payload = values; return query; },
      delete() { operation = "delete"; return query; },
      insert(values: Row | Row[]) { operation = "insert"; payload = values; return query; },
      maybeSingle() { return Promise.resolve(execute(true)); },
      then(resolve: (result: unknown) => unknown) { return Promise.resolve(execute()).then(resolve); },
    };
    return query;
  }, rpc() { throw new Error("Unexpected RPC/event/number allocation"); } };
  return { client: client as never, tables, original, get writes() { return writes; }, get attemptedUpdates() { return attemptedUpdates; } };
}

const identity = { companyId: "company", userId: "owner", changeOrderId: "order" };
const values: ChangeOrderFormValues = {
  title: "Edited order", changeOrderNumber: "CO-TEST", status: "draft", requestedDate: "2026-10-21",
  effectiveDate: "", preparedBy: "", requestedBy: "", customerId: "", projectId: "project", estimateId: "",
  description: "", reason: "", scheduleImpactDays: "0", taxRatePercent: "0", customerNotes: "", internalNotes: "",
};
const lineItems: ChangeOrderLineItemDraft[] = [{ id: "new-line", sortOrder: 0, description: "Edited line", quantity: "1", unit: "each", unitCost: "10", unitPrice: "30", notes: "" }];

test("archived orders reject edits before clearing archive, allocating numbers or replacing children", async () => {
  const f = fixture();
  const before = structuredClone(f.tables);
  const result = await saveChangeOrder({ ...identity, supabase: f.client, values: { ...values, changeOrderNumber: "" }, lineItems });
  assert.match(result.error || "", /Restore/);
  assert.equal(result.changeOrderId, null);
  assert.deepEqual(f.tables, before);
  assert.equal(f.attemptedUpdates, 0);
  assert.equal(f.writes, 0);
});

test("all archived workflow actions stop before mutation, activity or event publication", async () => {
  const cases = [
    ["draft", submitForApproval], ["pending_approval", approveChangeOrder],
    ["pending_approval", rejectChangeOrder], ["approved", reopenChangeOrder], ["draft", voidChangeOrder],
  ] as const;
  for (const [status, action] of cases) {
    const f = fixture(status);
    const before = structuredClone(f.tables);
    const result = await action({ ...identity, supabase: f.client });
    assert.match(result.error || "", /Restore/);
    assert.deepEqual(f.tables, before);
    assert.equal(f.attemptedUpdates, 0);
    assert.equal(f.writes, 0);
  }
});

test("archive arriving after read blocks both edit and workflow update without child/activity writes", async () => {
  for (const workflow of [false, true]) {
    const f = fixture("approved", false, true);
    const children = structuredClone(f.tables.change_order_line_items);
    const result = workflow
      ? await reopenChangeOrder({ ...identity, supabase: f.client })
      : await saveChangeOrder({ ...identity, supabase: f.client, values, lineItems });
    assert.match(result.error || "", /archived/);
    assert.equal(f.tables.change_orders[0].archived_at, "2026-10-21");
    assert.equal(f.tables.change_orders[0].status, "approved");
    assert.deepEqual(f.tables.change_order_line_items, children);
    assert.equal(f.tables.change_order_activity.length, 0);
    assert.equal(f.writes, 0);
  }
});

test("active edit and valid reopen remain available and company scoped", async () => {
  const edit = fixture("draft", false);
  assert.equal((await saveChangeOrder({ ...identity, supabase: edit.client, values, lineItems })).error, null);
  assert.equal(edit.tables.change_orders[0].title, "Edited order");
  assert.equal(edit.tables.change_orders[0].archived_at, null);
  assert.equal(edit.tables.change_order_line_items[0].description, "Edited line");
  assert.equal(edit.tables.change_orders[1].title, undefined);
  const reopen = fixture("approved", false);
  assert.equal((await reopenChangeOrder({ ...identity, supabase: reopen.client })).error, null);
  assert.equal(reopen.tables.change_orders[0].status, "draft");
  assert.equal(reopen.tables.change_orders[1].status, "approved");
  assert.equal(reopen.tables.change_order_activity.length, 1);
});

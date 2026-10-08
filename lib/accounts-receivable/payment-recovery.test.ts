import assert from "node:assert/strict";
import test from "node:test";
import { markInvoicePaid } from "../invoices/service";
import { recordCustomerPayment } from "./service";

const company = "00000000-0000-4000-8000-000000000001";
const invoiceId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";
const paymentId = "00000000-0000-4000-8000-000000000004";
function fixture(fault: "read" | "missing" | "throw" | "event" | "second-event" | "insert" | "none", initialStatus = "sent") {
  const payments: unknown[] = [];
  let deletes = 0;
  let events = 0;
  let amountPaid = initialStatus === "paid" ? 100 : 0;
  let updates = 0;
  const client = { from(table: string) {
    let columns = "";
    let action = "read";
    let payload: unknown;
    const filters = new Map<string, unknown>();
    const resolve = () => {
      if (action !== "insert") assert.equal(filters.get("company_id"), company);
      if (table === "invoices") {
        if (action === "update") { updates++; return { data: null, error: null }; }
        if (columns === "amount_paid, status, paid_date") {
          if (fault === "throw") throw new Error("confirmation network failure");
          if (fault === "read") return { data: null, error: { message: "confirmation unavailable" } };
          if (fault === "missing") return { data: null, error: null };
          return { data: { amount_paid: amountPaid, status: amountPaid === 100 ? "paid" : "partially_paid", paid_date: null }, error: null };
        }
        return { data: { id: invoiceId, invoice_number: "TEST", total_amount: 100, amount_paid: amountPaid, status: initialStatus, estimate_id: null }, error: null };
      }
      if (table === "invoice_estimate_links") return { data: [], error: null };
      if (table === "invoice_payment_history") {
        if (action === "delete") { deletes++; payments.length = 0; return { data: null, error: null }; }
        if (action === "read") return { data: [], error: null };
        if (fault === "insert") return { data: null, error: { message: "receipt rejected" } };
        amountPaid = Number((payload as {amount:number}).amount);
        payments.push(payload); return { data: { id: paymentId }, error: null };
      }
      if (table === "invoice_line_items") return { data: [], error: null };
      if (table === "workflow_events") {
        events++;
        if (fault === "event" || (fault === "second-event" && events === 2)) return { data: null, error: { message: "event unavailable" } };
        return { data: { id: paymentId, company_id: company, event_type: filters.get("event_type"), reference_entity: "invoice", reference_id: invoiceId, occurred_at: "2026-10-08T00:00:00Z", version: 1, source_module: "payments", payload: {}, metadata: {}, idempotency_key: filters.get("idempotency_key") }, error: null };
      }
      throw new Error(`Unexpected table ${table}`);
    };
    const query = {
      order() { return query; },
      range() { return query; },
      update(value: unknown) { action = "update"; payload = value; return query; },
      select(value: string) { columns = value; return query; },
      eq(key: string, value: unknown) { filters.set(key, value); return query; },
      insert(value: unknown) { action = "insert"; payload = value; assert.equal((value as {company_id:string}).company_id, company); return query; },
      delete() { action = "delete"; return query; },
      maybeSingle() { return Promise.resolve().then(resolve); },
      single() { return Promise.resolve().then(resolve); },
      then(done: (value: unknown) => unknown) { return Promise.resolve().then(resolve).then(done); },
    };
    return query;
  } };
  return { client: client as never, payments, deletes: () => deletes, events: () => events, updates: () => updates };
}
const params = { companyId: company, invoiceId, userId, amount: 25, paymentDate: "2026-10-08", method: "check" };

test("committed receipts survive confirmation outages without inviting a second receipt", async () => {
  for (const fault of ["read", "missing", "throw"] as const) {
    const f = fixture(fault);
    const result = await recordCustomerPayment({ ...params, supabase: f.client });
    assert.equal(result.error, null, fault);
    assert.equal(f.payments.length, 1, fault);
    assert.equal(f.deletes(), 0, fault);
    assert.equal(result.paymentId, paymentId);
    assert.ok(result.warning);
    assert.equal(result.amountPaid, undefined);
    assert.equal(f.events(), 0);
  }
});

test("event failures after commit return recorded receipt and confirmed balances", async () => {
  for (const fault of ["event", "second-event", "none"] as const) {
    const f = fixture(fault);
    const result = await recordCustomerPayment({ ...params, supabase: f.client });
    assert.equal(result.error, null);
    assert.equal(result.paymentId, paymentId);
    assert.equal(result.amountPaid, 25);
    assert.equal(result.balanceDue, 75);
    assert.equal(result.isPaid, false);
    assert.equal(Boolean(result.warning), fault !== "none");
    assert.equal(f.payments.length, 1);
    assert.equal(f.deletes(), 0);
  }
});

test("rejected receipt remains an error with no saved payment or events", async () => {
  const f = fixture("insert");
  const result = await recordCustomerPayment({ ...params, supabase: f.client });
  assert.equal(result.error, "receipt rejected");
  assert.equal(f.payments.length, 0);
  assert.equal(f.events(), 0);
});


test("Mark Paid retains the committed final receipt without a stale second invoice update", async () => {
  for (const fault of ["none", "read", "missing", "throw", "event", "second-event"] as const) {
    const f = fixture(fault);
    const result = await markInvoicePaid({ supabase: f.client, companyId: company, invoiceId, userId });
    assert.equal(result.error, null, fault);
    assert.equal(f.payments.length, 1, fault);
    assert.equal((f.payments[0] as {amount:number}).amount, 100);
    assert.equal(f.deletes(), 0, fault);
    assert.equal(f.updates(), 0, fault);
    assert.equal((result as {paymentId?:string}).paymentId, paymentId);
    assert.equal(Boolean((result as {warning?:string}).warning), fault !== "none");
  }
});


test("Mark Paid does not create receipts for rejected inserts, draft/void or already paid invoices", async () => {
  const rejected = fixture("insert");
  assert.equal((await markInvoicePaid({ ...params, supabase: rejected.client })).error, "receipt rejected");
  assert.equal(rejected.payments.length, 0);
  for (const status of ["draft", "void", "paid"]) {
    const f = fixture("none", status);
    const result = await markInvoicePaid({ ...params, supabase: f.client });
    assert.equal(Boolean(result.error), status !== "paid");
    assert.equal(f.payments.length, 0);
    assert.equal(f.events(), 0);
  }
});

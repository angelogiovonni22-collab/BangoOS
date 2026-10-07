import assert from "node:assert/strict";
import test from "node:test";
import { isStripeEvent, processVerifiedBillingEvent, type StripeEvent } from "./webhook-processing";

type Admin = Parameters<typeof processVerifiedBillingEvent>[1];
function event(type = "invoice.payment_failed", object: Record<string, unknown> = { customer: "cus_fixture" }): StripeEvent {
  return { id: "evt_fixture", type, livemode: false, created: 1791336000, data: { object } };
}
function fixture(result: unknown = { status: "processed", duplicate: false }, lookupError: string | null = null, rpcError: string | null = null) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const admin = {
    from(table: string) {
      assert.equal(table, "bos_tenant_accounts");
      const query = {
        select(columns: string) { assert.equal(columns, "company_id"); return query; },
        eq(column: string, value: string) { assert.equal(column, "stripe_customer_id"); assert.equal(value, "cus_fixture"); return query; },
        async maybeSingle() { return { data: lookupError ? null : { company_id: "00000000-0000-0000-0000-000000000001" }, error: lookupError ? { message: lookupError } : null }; },
      };
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return { data: result, error: rpcError ? { message: rpcError } : null };
    },
  };
  return { admin: admin as unknown as Admin, calls };
}

test("failed payment is acknowledged only after confirmed atomic completion", async () => {
  const { admin, calls } = fixture();
  assert.deepEqual(await processVerifiedBillingEvent(event(), admin), { status: 200, body: { received: true, duplicate: false } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "apply_billing_webhook_event");
  assert.equal(calls[0].args.p_company_id, "00000000-0000-0000-0000-000000000001");
  assert.deepEqual(calls[0].args.p_event, event());
  assert.equal((calls[0].args.p_update as Record<string, unknown>).payment_method_status, "action_required");
  assert.equal((calls[0].args.p_update as Record<string, unknown>).lifecycle_status, "past_due");
});

test("only completed duplicates return success; failures and missing confirmation request a retry", async () => {
  assert.equal((await processVerifiedBillingEvent(event(), fixture({ status: "processed", duplicate: true }).admin)).body.duplicate, true);
  for (const result of [null, {}, { status: "received", duplicate: true }, { status: "failed", duplicate: false, error: "Synthetic failure" }]) {
    assert.equal((await processVerifiedBillingEvent(event(), fixture(result).admin)).status, 500);
  }
  assert.equal((await processVerifiedBillingEvent(event(), fixture(undefined, null, "RPC unavailable").admin)).status, 500);
});

test("company lookup failures are audited without applying a guessed tenant update", async () => {
  const { admin, calls } = fixture({ status: "failed", duplicate: false }, "Lookup unavailable");
  assert.equal((await processVerifiedBillingEvent(event(), admin)).status, 500);
  assert.equal(calls[0].args.p_processing_error, "Lookup unavailable");
  assert.equal(calls[0].args.p_update, null);
});

test("checkout and subscription lifecycle patches retain their company and entitlement mapping", async () => {
  const checkout = fixture();
  await processVerifiedBillingEvent(event("checkout.session.completed", { client_reference_id: "00000000-0000-0000-0000-000000000002", customer: "cus_fixture", subscription: "sub_fixture" }), checkout.admin);
  assert.equal(checkout.calls[0].args.p_company_id, "00000000-0000-0000-0000-000000000002");
  assert.equal((checkout.calls[0].args.p_update as Record<string, unknown>).stripe_subscription_id, "sub_fixture");
  for (const [status, expected] of [["trialing", "trial"], ["active", "active"], ["canceled", "canceled"], ["paused", "suspended"]]) {
    const sub = fixture();
    await processVerifiedBillingEvent(event("customer.subscription.updated", { id: "sub_fixture", status, customer: "cus_fixture", metadata: { company_id: "00000000-0000-0000-0000-000000000003" }, cancel_at_period_end: true }), sub.admin);
    const patch = sub.calls[0].args.p_update as Record<string, unknown>;
    assert.equal(patch.lifecycle_status, expected);
    assert.equal(patch.cancel_at_period_end, true);
    assert.equal(sub.calls[0].args.p_company_id, "00000000-0000-0000-0000-000000000003");
  }
});

test("paid and unknown events do not invent unrelated lifecycle or company changes", async () => {
  const paid = fixture();
  await processVerifiedBillingEvent(event("invoice.paid"), paid.admin);
  const patch = paid.calls[0].args.p_update as Record<string, unknown>;
  assert.equal(patch.payment_method_status, "current");
  assert.equal(patch.last_payment_at, new Date(1791336000000).toISOString());
  assert.equal(patch.lifecycle_status, undefined);
  const unknown = fixture({ status: "ignored", duplicate: false });
  assert.equal((await processVerifiedBillingEvent(event("unknown.event", { metadata: { company_id: "invalid" } }), unknown.admin)).status, 200);
  assert.equal(unknown.calls[0].args.p_update, null);
  assert.equal(unknown.calls[0].args.p_company_id, null);
});

test("malformed signed event shapes are rejected before persistence", () => {
  assert.equal(isStripeEvent(event()), true);
  for (const value of [null, [], {}, { ...event(), id: "" }, { ...event(), livemode: "false" }, { ...event(), created: Infinity }, { ...event(), data: { object: [] } }]) {
    assert.equal(isStripeEvent(value), false);
  }
});


test("invalid company metadata is recorded as failure rather than rejected by RPC UUID casting", async () => {
  const { admin, calls } = fixture({ status: "failed", duplicate: false });
  assert.equal((await processVerifiedBillingEvent(event("invoice.paid", { metadata: { company_id: "invalid-company" } }), admin)).status, 500);
  assert.equal(calls[0].args.p_company_id, null);
  assert.equal(calls[0].args.p_update, null);
  assert.match(String(calls[0].args.p_processing_error), /invalid company reference/);
});

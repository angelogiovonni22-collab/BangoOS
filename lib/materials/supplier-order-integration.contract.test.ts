import assert from "node:assert/strict";
import test from "node:test";
import { authorizeSupplierOrderSubmission, evaluateSupplierOrderReadiness } from "./supplier-order-integration";

const connected = {
  vendorId: "vendor-1",
  vendorName: "Test Supplier",
  channel: "api" as const,
  enabled: true,
  endpointConfigured: true,
  credentialsConfigured: true,
  supportsAvailability: true,
  supportsPricing: true,
  supportsOrderSubmission: true,
};

test("connected supplier channel is ready but still requires human approval", () => {
  const readiness = evaluateSupplierOrderReadiness(connected);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.requiresHumanApproval, true);
});

test("missing credentials block electronic supplier submission", () => {
  const readiness = evaluateSupplierOrderReadiness({ ...connected, credentialsConfigured: false });
  assert.equal(readiness.ready, false);
  assert.match(readiness.blockers.join(" "), /credentials/i);
});

test("a connected supplier cannot receive an unapproved order", () => {
  const result = authorizeSupplierOrderSubmission({ purchaseOrderId: "po-1", approved: false, approvalConfirmedAt: null, capability: connected });
  assert.equal(result.authorized, false);
  assert.match(result.blockers.join(" "), /approval/i);
});

test("explicitly approved purchase order can pass the integration authorization boundary", () => {
  const result = authorizeSupplierOrderSubmission({ purchaseOrderId: "po-1", approved: true, approvalConfirmedAt: "2026-08-27T12:00:00Z", capability: connected });
  assert.equal(result.authorized, true);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeSupplierOrderRequest, validateSupplierOrderRequest, type SupplierCommerceProvider, type SupplierOrderRequest } from "./supplier-commerce";

const provider: SupplierCommerceProvider = {
  capability: {
    vendorId: "test",
    vendorName: "Test Supplier",
    channel: "api",
    enabled: true,
    endpointConfigured: true,
    credentialsConfigured: true,
    supportsAvailability: true,
    supportsPricing: true,
    supportsOrderSubmission: true,
  },
  async searchProducts() { return []; },
  async submitOrder() { return { externalOrderId: "x", externalOrderReference: "x", status: "submitted", metadata: {} }; },
};

function order(overrides: Partial<SupplierOrderRequest> = {}): SupplierOrderRequest {
  return {
    purchaseOrderId: "po-1",
    idempotencyKey: "po-1:v1",
    approved: true,
    approvalConfirmedAt: "2026-09-04T12:00:00Z",
    delivery: { method: "pickup", storeId: "1159" },
    lines: [{ supplierSku: "5013974981", description: "Material", quantity: 2, unitPrice: 8.98 }],
    ...overrides,
  };
}

test("supplier submission requires explicit approval", () => {
  const result = validateSupplierOrderRequest(provider, order({ approved: false, approvalConfirmedAt: null }));
  assert.equal(result.authorized, false);
  assert.match(result.blockers.join(" "), /approval/i);
});

test("supplier submission requires idempotency and valid delivery", () => {
  const result = validateSupplierOrderRequest(provider, order({ idempotencyKey: "", delivery: { method: "delivery", address: null } }));
  assert.equal(result.authorized, false);
  assert.match(result.blockers.join(" "), /idempotency/i);
  assert.match(result.blockers.join(" "), /delivery address/i);
});

test("approved reviewed order is eligible for provider transport", () => {
  const result = validateSupplierOrderRequest(provider, order());
  assert.deepEqual(result, { authorized: true, blockers: [] });
});

test("sanitized request excludes approval/security material", () => {
  const sanitized = sanitizeSupplierOrderRequest(order());
  assert.equal("approved" in sanitized, false);
  assert.equal("approvalConfirmedAt" in sanitized, false);
  assert.equal(sanitized.lines[0]?.supplierSku, "5013974981");
});

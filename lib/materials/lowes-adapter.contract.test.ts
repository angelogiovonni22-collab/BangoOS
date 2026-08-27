import assert from "node:assert/strict";
import test from "node:test";
import { authorizeLowesOrder, evaluateLowesIntegration, type LowesAdapterConfig } from "./lowes-adapter";

const connected: LowesAdapterConfig = {
  environment: "sandbox",
  clientIdConfigured: true,
  clientSecretConfigured: true,
  apiBaseUrlConfigured: true,
  proAccountLinked: true,
  productCatalogEnabled: true,
  pricingEnabled: true,
  inventoryEnabled: true,
  orderingEnabled: true,
  orderStatusEnabled: true,
};

test("Lowe's adapter exposes catalog, pricing, inventory, ordering and status readiness", () => {
  const readiness = evaluateLowesIntegration(connected);
  assert.equal(readiness.catalogReady, true);
  assert.equal(readiness.pricingReady, true);
  assert.equal(readiness.inventoryReady, true);
  assert.equal(readiness.orderingReady, true);
  assert.equal(readiness.orderStatusReady, true);
});

test("Lowe's credentials and Pro account gate purchasing capabilities", () => {
  const readiness = evaluateLowesIntegration({ ...connected, clientSecretConfigured: false, proAccountLinked: false });
  assert.equal(readiness.catalogReady, false);
  assert.equal(readiness.pricingReady, false);
  assert.equal(readiness.orderingReady, false);
  assert.match(readiness.blockers.join(" "), /client secret/i);
  assert.match(readiness.blockers.join(" "), /Pro account/i);
});

test("Lowe's order cannot pass without explicit human PO approval", () => {
  const result = authorizeLowesOrder({ purchaseOrderId: "po-lowes-1", approved: false, approvalConfirmedAt: null, config: connected });
  assert.equal(result.authorized, false);
  assert.match(result.blockers.join(" "), /approval/i);
});

test("approved PO can cross adapter authorization only after integration is ready", () => {
  const result = authorizeLowesOrder({ purchaseOrderId: "po-lowes-1", approved: true, approvalConfirmedAt: "2026-08-27T18:00:00Z", config: connected });
  assert.equal(result.authorized, true);
});

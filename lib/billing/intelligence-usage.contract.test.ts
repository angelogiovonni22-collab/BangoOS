import assert from "node:assert/strict";
import { BOS_INTELLIGENCE_PRODUCTS, quoteBosIntelligenceUsage, settledCreditDelta } from "./intelligence-usage";

assert.deepEqual(Object.keys(BOS_INTELLIGENCE_PRODUCTS).sort(), [
  "blueprint_3d_reconstruction",
  "blueprint_native_analysis",
  "blueprint_vision_analysis",
  "blueprint_visual_mockup",
  "orion_autonomous_action",
  "orion_document",
  "orion_text",
  "orion_voice",
]);

const paid = quoteBosIntelligenceUsage({
  product: "blueprint_vision_analysis",
  quantity: 2,
  pricePerCreditCents: 100,
  estimatedProviderCostMicros: 240_000,
});
assert.equal(paid.credits, 10);
assert.equal(paid.customerChargeCents, 1_000);
assert.equal(paid.estimatedMarginCents, 976);
assert.equal(paid.requiresConfirmation, true, "Paid intelligence work must require price confirmation");
assert.equal(settledCreditDelta(paid, "succeeded"), -10);
assert.equal(settledCreditDelta(paid, "bos_failed"), 0, "B.O.S. failures must never consume customer credits");
assert.equal(settledCreditDelta(paid, "customer_canceled"), 0, "Canceled work must never consume customer credits");

const internal = quoteBosIntelligenceUsage({
  product: "orion_voice",
  quantity: 12,
  pricePerCreditCents: 100,
  internalNonBillable: true,
});
assert.equal(internal.billable, false);
assert.equal(internal.customerChargeCents, 0);
assert.equal(internal.requiresConfirmation, false);
assert.equal(settledCreditDelta(internal, "succeeded"), 0, "Internal non-billable use must not consume paid credits");

console.log("B.O.S. Intelligence usage metering contract checks passed.");

import assert from "node:assert/strict";
import test from "node:test";
import { evaluateThreeWayMatch, summarizeBillMatch } from "./ap-three-way-match";

test("exact PO receipt and invoice is approval ready", () => {
  const result = evaluateThreeWayMatch({ poQuantity: 100, poUnitCost: 3.8, receivedQuantity: 100, billedQuantity: 100, billedUnitCost: 3.8 });
  assert.equal(result.status, "matched");
  assert.equal(result.approvalReady, true);
  assert.equal(result.billedAmount, 380);
});

test("price variance blocks approval", () => {
  const result = evaluateThreeWayMatch({ poQuantity: 100, poUnitCost: 3.8, receivedQuantity: 100, billedQuantity: 100, billedUnitCost: 4.15 });
  assert.equal(result.status, "price_variance");
  assert.equal(result.approvalReady, false);
  assert.equal(result.priceVariance, 0.35);
});

test("quantity variance blocks approval", () => {
  const result = evaluateThreeWayMatch({ poQuantity: 100, poUnitCost: 3.8, receivedQuantity: 88, billedQuantity: 100, billedUnitCost: 3.8 });
  assert.equal(result.status, "quantity_variance");
  assert.equal(result.quantityVariance, 12);
});

test("missing evidence and duplicate invoice remain blocked", () => {
  assert.equal(evaluateThreeWayMatch({ poQuantity: null, poUnitCost: null, receivedQuantity: null, billedQuantity: 1, billedUnitCost: 10 }).status, "missing_po");
  assert.equal(evaluateThreeWayMatch({ poQuantity: 1, poUnitCost: 10, receivedQuantity: null, billedQuantity: 1, billedUnitCost: 10 }).status, "missing_receipt");
  assert.equal(evaluateThreeWayMatch({ poQuantity: 1, poUnitCost: 10, receivedQuantity: 1, billedQuantity: 1, billedUnitCost: 10, duplicateInvoice: true }).status, "duplicate_invoice");
});

test("bill summary is ready only when every line matches", () => {
  const matched = evaluateThreeWayMatch({ poQuantity: 2, poUnitCost: 10, receivedQuantity: 2, billedQuantity: 2, billedUnitCost: 10 });
  const variance = evaluateThreeWayMatch({ poQuantity: 1, poUnitCost: 5, receivedQuantity: 1, billedQuantity: 1, billedUnitCost: 6 });
  assert.equal(summarizeBillMatch([matched]).approvalReady, true);
  assert.equal(summarizeBillMatch([matched, variance]).approvalReady, false);
});

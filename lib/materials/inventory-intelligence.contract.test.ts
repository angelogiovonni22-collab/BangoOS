import assert from "node:assert/strict";
import test from "node:test";
import { applyInventoryMovement, availableQuantity, inventoryHealth, inventoryValue, reorderSuggestion } from "./inventory-intelligence";

const balance = { materialId: "m1", locationId: "warehouse", onHand: 20, reserved: 5, reorderPoint: 6, unitCost: 4 };

test("inventory exposes available quantity and stock value", () => {
  assert.equal(availableQuantity(balance), 15);
  assert.equal(inventoryValue(balance), 80);
  assert.equal(inventoryHealth(balance), "healthy");
});

test("receiving increases stock and allocation reserves only available stock", () => {
  const received = applyInventoryMovement(balance, { type: "receive", quantity: 10 });
  assert.equal(received.ok, true);
  if (received.ok) assert.equal(received.balance.onHand, 30);
  const blocked = applyInventoryMovement(balance, { type: "allocate", quantity: 16 });
  assert.equal(blocked.ok, false);
});

test("consumption reduces both on-hand and project reservation", () => {
  const result = applyInventoryMovement(balance, { type: "consume", quantity: 4 });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual([result.balance.onHand, result.balance.reserved], [16, 1]);
});

test("unsafe standalone adjustments and transfers are rejected", () => {
  assert.equal(applyInventoryMovement(balance, { type: "adjust", quantity: 1 }).ok, false);
  assert.equal(applyInventoryMovement(balance, { type: "transfer", quantity: 1 }).ok, false);
});

test("low stock creates a replenishment suggestion", () => {
  const low = { ...balance, onHand: 8, reserved: 4 };
  assert.equal(inventoryHealth(low), "low");
  assert.equal(reorderSuggestion(low, 20), 16);
});

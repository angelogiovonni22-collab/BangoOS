import assert from "node:assert/strict";
import test from "node:test";
import { authorizeProcurement, directCost, procurementVariance, rankSupplierOffers, receivedCost, receivingStatus } from "./procurement-intelligence";

const lines = [
  { id: "stud", description: "2x4 stud", quantity: 10, unitCost: 3.5, receivedQuantity: 4 },
  { id: "osb", description: "OSB", quantity: 2, unitCost: 14, receivedQuantity: 0 },
];

test("procurement totals committed and received material costs", () => {
  assert.equal(directCost(lines), 63);
  assert.equal(receivedCost(lines), 14);
  assert.equal(receivingStatus(lines), "partially_received");
});

test("supplier comparison ranks available offers by landed cost then ETA", () => {
  const ranked = rankSupplierOffers([
    { supplierId: "a", supplierName: "A", materialSubtotal: 100, deliveryCost: 20, available: true, etaDays: 1 },
    { supplierId: "b", supplierName: "B", materialSubtotal: 105, deliveryCost: 5, available: true, etaDays: 3 },
    { supplierId: "c", supplierName: "C", materialSubtotal: 90, deliveryCost: 0, available: false, etaDays: 1 },
  ]);
  assert.deepEqual(ranked.map((offer) => offer.supplierId), ["b", "a"]);
});

test("procurement blocks unattended, over-budget and duplicate purchases", () => {
  const result = authorizeProcurement({
    approval: { approvedBy: null, approvedAt: null, budgetConfirmed: false },
    directCost: 1200,
    projectBudgetRemaining: 1000,
    duplicateOrderDetected: true,
  });
  assert.equal(result.authorized, false);
  assert.match(result.blockers.join(" "), /human approval/i);
  assert.match(result.blockers.join(" "), /budget/i);
  assert.match(result.blockers.join(" "), /duplicate/i);
});

test("approved in-budget nonduplicate procurement can proceed to supplier authorization", () => {
  const result = authorizeProcurement({
    approval: { approvedBy: "owner", approvedAt: "2026-08-27T18:00:00Z", budgetConfirmed: true },
    directCost: 800,
    projectBudgetRemaining: 1000,
    duplicateOrderDetected: false,
  });
  assert.equal(result.authorized, true);
});

test("procurement variance exposes committed cost movement", () => {
  assert.deepEqual(procurementVariance(1000, 1100), { amount: 100, percent: 10 });
});

import assert from "node:assert/strict";
import test from "node:test";
import { authorizeProcurementSubmission } from "./procurement-workflow";

const supplier = {
  vendorId: "test",
  vendorName: "Test Supplier",
  channel: "api" as const,
  enabled: true,
  endpointConfigured: true,
  credentialsConfigured: true,
  supportsAvailability: true,
  supportsPricing: true,
  supportsOrderSubmission: true,
};

const lines = [{ id: "1", description: "Stud", quantity: 10, unitCost: 4, receivedQuantity: 0 }];

test("procurement approval chain blocks before supplier submission", () => {
  const result = authorizeProcurementSubmission({
    purchaseOrderId: "po-1", lines,
    approval: { approvedBy: null, approvedAt: null, budgetConfirmed: true },
    projectBudgetRemaining: 100,
    duplicateOrderDetected: false,
    supplier,
  });
  assert.equal(result.authorized, false);
  assert.equal(result.stage, "procurement");
});

test("approved safe procurement reaches supplier authorization", () => {
  const result = authorizeProcurementSubmission({
    purchaseOrderId: "po-1", lines,
    approval: { approvedBy: "owner", approvedAt: "2026-08-27T18:00:00Z", budgetConfirmed: true },
    projectBudgetRemaining: 100,
    duplicateOrderDetected: false,
    supplier,
  });
  assert.equal(result.authorized, true);
  assert.equal(result.stage, "supplier");
});

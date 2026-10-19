import assert from "node:assert/strict";
import test from "node:test";
import { receiptCommandOperationId } from "./receipt-operation-id";

test("command receipt operations survive retries while isolating company and command keys", async () => {
  const operation = await receiptCommandOperationId("company-a", "command-a");
  assert.match(operation, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(operation, await receiptCommandOperationId("company-a", "command-a"));
  assert.notEqual(operation, await receiptCommandOperationId("company-b", "command-a"));
  assert.notEqual(operation, await receiptCommandOperationId("company-a", "command-b"));
});

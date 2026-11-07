import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EquipmentDispatchUnavailableError, requireEquipmentDispatchSuccess } from "./equipment-dispatch-result";

test("an unsuccessful equipment dispatch rejects instead of reporting an assignment", async () => {
  let calls = 0;
  await assert.rejects(requireEquipmentDispatchSuccess(async () => {
    calls += 1;
    return { success: false };
  }), (error) => error instanceof EquipmentDispatchUnavailableError && /Equipment was not assigned.*equipment profile/.test(error.message));
  assert.equal(calls, 1, "a failed dispatch must not be retried as a separate assignment");
});

test("a confirmed equipment dispatch completes once", async () => {
  let calls = 0;
  await requireEquipmentDispatchSuccess(async () => { calls += 1; return { success: true }; });
  assert.equal(calls, 1);
});

test("provider errors propagate without becoming successful assignments", async () => {
  const failure = new Error("Synthetic provider unavailable");
  await assert.rejects(requireEquipmentDispatchSuccess(async () => { throw failure; }), (error) => error === failure);
});

test("the workforce assignment path requires provider success before returning", () => {
  const service = readFileSync("lib/crews/workforce-operations-service.ts", "utf8");
  assert.match(service, /await requireEquipmentDispatchSuccess\(\(\) => equipmentDispatch\.assignCrewEquipment/);
  const hook = readFileSync("lib/crews/use-workforce-operations-dashboard.ts", "utf8");
  assert.match(hook, /caught instanceof EquipmentDispatchUnavailableError \? caught\.message/);
  const dashboard = readFileSync("components/crews/workforce-operations-dashboard.tsx", "utf8");
  assert.match(dashboard, /if \(errorMessage && !data\)/, "action failures retain the already loaded workspace");
  assert.match(dashboard, /title="Supervisor action was not completed" description=\{errorMessage\}/);
});

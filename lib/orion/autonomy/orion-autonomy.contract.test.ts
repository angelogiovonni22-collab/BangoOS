import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createOrionCommandRegistry } from "@/lib/orion/commands";
import {
  ORION_MAX_AUTONOMOUS_STEPS,
  autonomyModeForCommand,
  canContinueAutonomousSequence,
  classifyOrionCommandRisk,
  effectiveOrionConfirmationLevel,
} from "./policy";

const registry = createOrionCommandRegistry();
const command = (id: string) => {
  const found = registry.getById(id);
  assert.ok(found, `missing command ${id}`);
  return found;
};

for (const id of ["customer.open", "project.open", "schedule.read_range", "dashboard.open"]) {
  assert.equal(autonomyModeForCommand(command(id)), "auto", `${id} should remain autonomous`);
}

for (const id of ["estimate.send", "invoice.send", "customer_update.send", "permit.submit"]) {
  assert.equal(classifyOrionCommandRisk(command(id)), "external_effect", `${id} should be external effect`);
  assert.equal(effectiveOrionConfirmationLevel(command(id)), "REQUIRED", `${id} must require explicit confirmation`);
}

for (const id of ["invoice.record_payment", "invoice.record_deposit", "estimate.generate_deposit_invoice"]) {
  assert.equal(classifyOrionCommandRisk(command(id)), "financial", `${id} should be financial`);
  assert.equal(effectiveOrionConfirmationLevel(command(id)), "REQUIRED", `${id} must require explicit confirmation`);
}

for (const id of ["customer.archive", "employee.archive", "crew.remove", "project.archive"]) {
  assert.equal(classifyOrionCommandRisk(command(id)), "destructive", `${id} should be destructive`);
  assert.equal(effectiveOrionConfirmationLevel(command(id)), "REQUIRED", `${id} must require explicit confirmation`);
}

for (const id of ["estimate.approve", "estimate.decline", "estimate.convert", "inspection.pass", "permit.issue"]) {
  assert.equal(classifyOrionCommandRisk(command(id)), "legal_or_authority", `${id} should be legal/authority sensitive`);
  assert.equal(effectiveOrionConfirmationLevel(command(id)), "REQUIRED", `${id} must require explicit confirmation`);
}

assert.equal(ORION_MAX_AUTONOMOUS_STEPS, 8);
assert.equal(canContinueAutonomousSequence({ stepNumber: 1, previousOk: true, previousVerified: true, nextMode: "auto" }), true);
assert.equal(canContinueAutonomousSequence({ stepNumber: 9, previousOk: true, previousVerified: true, nextMode: "auto" }), false);
assert.equal(canContinueAutonomousSequence({ stepNumber: 2, previousOk: false, previousVerified: true, nextMode: "auto" }), false);
assert.equal(canContinueAutonomousSequence({ stepNumber: 2, previousOk: true, previousVerified: false, nextMode: "auto" }), false);
assert.equal(canContinueAutonomousSequence({ stepNumber: 2, previousOk: true, previousVerified: true, nextMode: "confirm" }), false);
assert.equal(canContinueAutonomousSequence({ stepNumber: 2, previousOk: true, previousVerified: true, nextMode: "review" }), false);

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const toolRoute = read("app/api/orion/realtime/tool/route.ts");
assert.ok(toolRoute.includes("effectiveOrionConfirmationLevel"), "Realtime tool route must enforce central autonomy confirmation policy");
assert.ok(toolRoute.includes("autonomyRisk") && toolRoute.includes("autonomyMode"), "Realtime tool outputs must expose autonomy telemetry");
assert.ok(toolRoute.includes("policyEnforced"), "policy-forced confirmations must be distinguishable from registry confirmations");
assert.ok(toolRoute.includes("timingSafeEqual") && toolRoute.includes("companyId") && toolRoute.includes("userId"), "confirmation tokens must remain signed and tenant/user bound");
assert.ok(toolRoute.includes("createOrionExecutionEnvelope"), "canonical executions must retain idempotency/correlation envelopes");

const operator = read("lib/orion/operator/browser.ts");
assert.ok(operator.includes("DESTRUCTIVE_TEXT") && operator.includes("requiresCanonicalConfirmation"), "UI operator must continue blocking destructive direct clicks");
assert.ok(operator.includes("waitForVerifiedUiOutcome"), "visible action completion must remain verified before success is claimed");

console.log("Orion autonomy guardrail contract passed.");

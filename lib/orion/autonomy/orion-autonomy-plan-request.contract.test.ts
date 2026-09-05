import fs from "node:fs";
import path from "node:path";
import { buildOrionAutonomyPlanFromToolSteps } from "./plan-request";

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) { console.log(`  + ${message}`); passed += 1; }
  else { console.error(`  x FAIL: ${message}`); failed += 1; }
}

function main() {
  console.log("\nOrion autonomy plan request contract");

  const empty = buildOrionAutonomyPlanFromToolSteps([]);
  assert(!empty.ok, "empty plans are rejected");

  const unknown = buildOrionAutonomyPlanFromToolSteps([{ toolName: "bos_not_a_real_command" }]);
  assert(!unknown.ok, "unknown BOS tools are rejected");

  const safe = buildOrionAutonomyPlanFromToolSteps([
    { toolName: "bos_project_open", params: { entityId: "project-1" } },
    { toolName: "bos_customer_open", params: { entityId: "customer-1" } },
  ]);
  assert(safe.ok && safe.plan.autonomousPrefixLength === 2, "read-only canonical BOS tools produce an autonomous safe prefix");

  const gated = buildOrionAutonomyPlanFromToolSteps([
    { toolName: "bos_project_open", params: { entityId: "project-1" } },
    { toolName: "bos_invoice_send", params: { entityId: "invoice-1" } },
  ]);
  assert(gated.ok && gated.plan.autonomousPrefixLength === 1, "planning stops before an external-effect command");
  assert(gated.ok && gated.plan.nextBlockedStep?.stopReason === "confirmation_required", "external-effect command is confirmation gated");

  const route = fs.readFileSync(path.resolve(process.cwd(), "app/api/orion/autonomy/plan/route.ts"), "utf8");
  assert(route.includes("resolveWorkspaceContext"), "planning endpoint requires an authenticated BOS workspace");
  assert(route.includes("buildOrionAutonomyPlanFromToolSteps"), "planning endpoint uses the canonical autonomy plan resolver");
  assert(!route.includes("executeCommand("), "planning endpoint cannot execute BOS commands");

  console.log(`\nOrion autonomy plan request results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) { console.log(`  + ${message}`); passed += 1; }
  else { console.error(`  x FAIL: ${message}`); failed += 1; }
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const executor = read("lib/orion/autonomy/safe-read-executor.ts");
  const route = read("app/api/orion/autonomy/execute-safe-read/route.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const policy = read("lib/orion/intelligence/orion-tool-router.ts");

  console.log("\nOrion protected-boundary handoff contract");

  assert(executor.includes("export type OrionProtectedBoundaryHandoff"), "safe-read executor has a typed protected-boundary handoff");
  assert(executor.includes('nextBlockedStep.stopReason === "step_limit"'), "step-limit boundaries never generate a protected handoff that could bypass the unattended cap");
  assert(executor.includes("blockedAuthorization = await authorizeOrionCommand"), "the blocked command is permission-preflighted before handoff");
  assert(executor.includes("blockedReferenceResolution = resolveOrionStepReferences"), "verified prior read outputs are resolved into the blocked action without guessing ids");
  assert(executor.includes("params: asParams(blockedReferenceResolution.value)"), "handoff contains the exact resolved protected-action params");
  assert(executor.includes('confirmationRequired: nextBlockedStep.mode === "confirm"'), "handoff explicitly marks confirmation-required boundaries");
  assert(executor.includes('reviewRequired: nextBlockedStep.mode === "review"'), "handoff explicitly marks review-required boundaries");
  assert((executor.match(/router\.executeCommand\(/g) || []).length === 1, "safe-read executor has only the read-step execution call and never executes the blocked command");
  assert(!route.includes("confirmed: true") && !route.includes("confirmationToken"), "safe-read endpoint still cannot manufacture confirmation for the protected action");

  assert(bridge.includes("nextBlockedAction?: unknown"), "Realtime bridge accepts the protected handoff from the safe-read endpoint");
  assert(bridge.includes("nextBlockedAction: payload.nextBlockedAction ?? null"), "Realtime returns the exact protected handoff to the model");
  assert(policy.includes("Protected-boundary handoff policy:"), "Orion system policy requires the canonical protected tool after the safe-read boundary");
  assert(policy.includes("never bypass its review or confirmation response"), "Orion system policy preserves canonical review and confirmation controls");

  console.log(`\nOrion protected-boundary handoff results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

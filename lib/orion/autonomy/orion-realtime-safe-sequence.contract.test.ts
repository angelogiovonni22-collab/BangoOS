import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const session = read("app/api/orion/realtime/session/route.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const executor = read("lib/orion/autonomy/safe-read-executor.ts");
  const endpoint = read("app/api/orion/autonomy/execute-safe-read/route.ts");

  console.log("\nOrion Realtime safe-sequence contract");

  assert(session.includes('const AUTONOMY_SAFE_READ_TOOL_NAME = "orion_autonomy_safe_read"'), "Realtime declares the guarded multi-step safe-read tool");
  assert(session.includes("name: AUTONOMY_SAFE_READ_TOOL_NAME"), "Realtime exposes the guarded tool to the model");
  assert(session.includes("maxItems: 8"), "Realtime tool schema preserves the eight-step unattended cap");
  assert(session.includes("Multi-step autonomy policy:"), "Realtime instructions explicitly direct ordered read sequences through the guarded tool");
  assert(session.includes("Never bypass a returned boundary"), "Realtime instructions preserve write/review/confirmation boundaries");

  assert(bridge.includes('export const ORION_AUTONOMY_SAFE_READ_TOOL = "orion_autonomy_safe_read"'), "browser tool bridge recognizes the guarded safe-read tool");
  assert(bridge.includes('fetch("/api/orion/autonomy/execute-safe-read"'), "bridge routes the tool through the authenticated safe-read endpoint");
  assert(bridge.includes("requestedExecutionId") && bridge.includes("call.callId"), "bridge provides a retry-stable execution identifier");
  assert(bridge.includes("nextBlockedStep") && bridge.includes("stopReason"), "bridge returns the autonomy boundary back to Realtime");

  assert(endpoint.includes("resolveWorkspaceContext"), "safe-read endpoint requires authenticated workspace context");
  assert(endpoint.includes("executeOrionSafeReadPrefix"), "safe-read endpoint delegates to the guarded executor");
  assert(executor.includes('classifyOrionCommandRisk(command) !== "read"'), "executor hard-stops before every non-read command");
  assert(executor.includes("authorizeOrionCommand"), "executor re-authorizes every autonomous read step");
  assert(executor.includes("command.validate(fastParams.params)"), "executor validates every autonomous read step");
  assert(executor.includes("verifyOrionAutonomousReadResult({ command, result })") && executor.includes("const verified = verification.ok"), "executor semantically verifies every successful read before advancing");

  console.log(`\nOrion Realtime safe-sequence results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

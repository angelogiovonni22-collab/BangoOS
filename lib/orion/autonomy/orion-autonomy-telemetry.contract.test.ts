import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) { console.log(`  + ${message}`); passed += 1; }
  else { console.error(`  x FAIL: ${message}`); failed += 1; }
}
function read(relativePath: string) { return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8"); }

function main() {
  const executor = read("lib/orion/autonomy/safe-read-executor.ts");
  const route = read("app/api/orion/autonomy/execute-safe-read/route.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  console.log("\nOrion autonomy telemetry contract");
  assert(executor.includes("durationMs: number"), "each completed autonomous read exposes bounded latency metadata");
  assert(executor.includes("const stepStartedAt = Date.now()"), "read-step timing begins inside the guarded executor");
  assert(executor.includes("Math.max(0, Date.now() - stepStartedAt)"), "read-step duration cannot become negative");
  assert(route.includes("const sequenceStartedAt = Date.now()"), "sequence latency is measured server-side");
  assert(route.includes("executedSteps: result.executed.length"), "sequence telemetry reports completed-step count without payload data");
  assert(route.includes("step.attempts - 1"), "sequence telemetry reports bounded retry count");
  assert(route.includes("slowestStepMs"), "sequence telemetry identifies latency pressure without exposing command parameters");
  assert(route.includes('response.headers.set("Server-Timing"'), "safe-read latency is observable through a standard server timing header");
  assert(bridge.includes("telemetry: payload.telemetry ?? null"), "Realtime receives safe aggregate telemetry with the guarded result");
  assert(!route.includes("telemetry: { params") && !route.includes("telemetry: { details"), "telemetry does not copy user parameters or command result details");
  console.log(`\nOrion autonomy telemetry results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
main();

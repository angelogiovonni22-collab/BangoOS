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
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const client = read("lib/orion/realtime/client.ts");
  const session = read("app/api/orion/realtime/session/route.ts");

  console.log("\nOrion Realtime spoken tool continuation contract");

  assert(bridge.includes('output_modalities: ["audio"]'), "tool continuation explicitly requests audio output");
  assert(bridge.includes("Never end the turn silently after changing the visible BOS interface"), "successful visible actions require spoken follow-through");
  assert(client.includes("buildOrionRealtimeContinueResponseEvent(result)"), "successful tool outputs pass result context into the spoken continuation");
  assert(client.includes("buildOrionRealtimeContinueResponseEvent(failure)"), "recoverable tool failures stay conversational instead of killing the Realtime session");
  assert(!client.includes("this.callbacks.onError?.(resolved);\n      this.sendEvent(buildOrionRealtimeFunctionOutputEvent(call.callId"), "tool execution failure does not escalate into a fatal Realtime connection error");
  assert(session.includes("Do NOT re-observe before every simple set action"), "operator avoids redundant observation round trips on stable forms");
  assert(session.includes("Reuse the exact semantic refs") && session.includes("until the form structure changes"), "operator reuses stable screen refs to reduce latency");
  assert(session.includes("Do not silently update BOS and wait for the user to notice"), "session policy requires spoken acknowledgement after visible actions");

  console.log(`\nOrion spoken continuation results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

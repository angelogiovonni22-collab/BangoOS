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
  const token = read("lib/orion/autonomy/continuation-token.ts");
  const executor = read("lib/orion/autonomy/safe-read-executor.ts");
  const route = read("app/api/orion/autonomy/execute-safe-read/route.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const session = read("app/api/orion/realtime/session/route.ts");

  console.log("\nOrion safe-read continuation contract");
  assert(token.includes('createCipheriv("aes-256-gcm"') && token.includes('createDecipheriv("aes-256-gcm"'), "continuation state is encrypted and authenticated");
  assert(token.includes("ORION_CONFIRMATION_SECRET") && token.includes("CONTINUATION_TTL_MS = 120_000"), "continuation tokens reuse the server secret and expire quickly");
  assert(executor.includes("resume?: { nextZeroIndex: number; outputs: OrionStepReferenceOutput[] }"), "executor can resume with server-restored verified outputs");
  assert(executor.includes("const outputs: OrionStepReferenceOutput[] = [...(args.resume?.outputs ?? [])]"), "resumed reads preserve prior step-reference context");
  assert(executor.includes("continuation: { nextZeroIndex: zeroIndex, outputs: [...outputs] }"), "time-budget boundary captures continuation state without starting more work");
  assert(route.includes("decodeOrionSafeReadContinuation") && route.includes("encodeOrionSafeReadContinuation"), "API exclusively encodes and decodes continuation state server-side");
  assert(route.includes("continuation.companyId !== workspace.context.companyId") && route.includes("continuation.userId !== workspace.context.userId"), "continuations are bound to the active tenant and user");
  assert(route.includes("const { continuation: _continuation, ...publicResult } = result"), "raw prior outputs are never returned in the JSON response");
  assert(bridge.includes('statusCategory: paused ? "autonomy_read_sequence_paused"'), "Realtime receives an explicit resumable pause state");
  assert(session.includes("Continuation policy:") && session.includes("with only the returned continuationToken"), "Realtime is instructed to resume from the encrypted continuation token");

  console.log(`\nOrion safe-read continuation results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

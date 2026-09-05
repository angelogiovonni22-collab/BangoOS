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
  const evidence = read("lib/orion/autonomy/read-evidence.ts");
  const executor = read("lib/orion/autonomy/safe-read-executor.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");

  console.log("\nOrion read evidence contract");
  assert(evidence.includes("MAX_SERIALIZED_BYTES = 8_000"), "Realtime evidence has a per-step serialized size budget");
  assert(evidence.includes("MAX_DEPTH = 4") && evidence.includes("MAX_ARRAY_ITEMS = 20") && evidence.includes("MAX_OBJECT_KEYS = 40"), "evidence recursion and collection sizes are bounded");
  assert(evidence.includes("SENSITIVE_KEY") && evidence.includes("password") && evidence.includes("authorization") && evidence.includes("private[_-]?key"), "common secret-bearing keys are stripped before model handoff");
  assert(evidence.includes("Buffer.byteLength"), "evidence enforces the final UTF-8 payload budget");
  assert(evidence.includes("entityType: result.entityType") && evidence.includes("entityId: result.entityId"), "verified entity identity is retained for reasoning");
  assert(executor.includes("buildOrionReadEvidence(result)"), "safe-read executor builds evidence only from command results");
  assert(executor.includes("evidence:"), "safe-read execution returns bounded evidence per completed step");
  assert(executor.indexOf("buildOrionReadEvidence(result)") > executor.indexOf("verifyOrionAutonomousReadResult({ command, result })"), "evidence is built only after semantic result verification");
  assert(bridge.includes("executed: payload.executed ?? []"), "Realtime receives executed-step evidence through the existing authenticated bridge");

  console.log(`\nOrion read evidence results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

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
  const realtime = read("app/api/orion/realtime/session/route.ts");

  console.log("\nOrion parallel safe-read contract");
  assert(executor.includes("const MAX_PARALLEL_SAFE_READS = 4"), "parallelism is explicitly bounded");
  assert(executor.includes("hasOrionStepReference"), "step references disable unsafe parallel execution");
  assert(executor.includes("Promise.all(indexes.map((index) => executeReadStep(index, availableOutputs)))"), "independent safe reads execute concurrently");
  assert(executor.includes('classifyOrionCommandRisk(candidate) !== "read"'), "batch formation stops before any protected command");
  assert(executor.includes("authorizeOrionCommand") && executor.includes("command.validate(fastParams.params)"), "each parallel read retains authorization and canonical validation");
  assert(executor.includes("verifyOrionAutonomousReadResult({ command, result })"), "each parallel read retains semantic verification");
  assert(executor.includes("executed.sort((a, b) => a.index - b.index)") && executor.includes("outputs.sort((a, b) => a.index - b.index)"), "parallel results are returned in deterministic step order");
  assert(executor.includes("createOrionExecutionEnvelope") && executor.includes("idempotencyKey"), "parallel reads retain retry-stable execution identity");
  assert(realtime.includes("maxItems: 8"), "Realtime still preserves the eight-step unattended cap");

  console.log(`\nOrion parallel safe-read results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

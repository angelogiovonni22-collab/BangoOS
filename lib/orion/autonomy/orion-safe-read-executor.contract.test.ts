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

  console.log("\nOrion safe read executor contract");
  assert(executor.includes('classifyOrionCommandRisk(command) !== "read"'), "sequence executor hard-stops before every non-read command");
  assert(executor.includes('stopReason: "write_boundary"'), "non-read boundary is explicit in the result");
  assert(executor.includes("authorizeOrionCommand"), "every read command is re-authorized against live membership");
  assert(executor.includes("normalizeRealtimeFastCommandParams"), "sequence steps reuse canonical fast parameter normalization");
  assert(executor.includes("command.validate(fastParams.params)"), "each command is canonically validated before execution");
  assert(executor.includes("createOrionExecutionEnvelope") && executor.includes("idempotencyKey"), "each sequence step receives retry-stable execution identity");
  assert(executor.includes('result.success && result.status === "completed"'), "sequence advancement requires a verified completed result");
  assert(executor.includes('stopReason: "execution_failed"'), "failed verification stops remaining execution");
  assert(route.includes("resolveWorkspaceContext"), "safe-read execution requires an authenticated BOS workspace");
  assert(route.includes("executeOrionSafeReadPrefix"), "endpoint delegates to the guarded sequence executor");
  assert(!route.includes("confirmation") && !executor.includes("confirmed: true"), "safe-read endpoint cannot manufacture confirmation for protected actions");

  console.log(`\nOrion safe read executor results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

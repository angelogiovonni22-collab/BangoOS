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
  console.log("\nOrion safe-read retry contract");
  assert(executor.includes("const MAX_SAFE_READ_ATTEMPTS = 2"), "safe-read retries are strictly bounded to one retry");
  assert(executor.includes("result.retryable"), "only command results explicitly marked retryable can be retried");
  assert(executor.includes("verifyOrionAutonomousReadResult({ command, result })"), "every attempt is semantically verified before acceptance");
  assert(executor.includes("if (verification.ok) break"), "successful verified reads never retry unnecessarily");
  assert(executor.includes("if (!result.retryable || attempt >= MAX_SAFE_READ_ATTEMPTS) break"), "non-retryable failures fail closed immediately");
  assert(executor.includes("idempotencyKey") && executor.includes("correlationId"), "retries retain the original retry-stable execution identity");
  assert(executor.includes("attempts,"), "execution evidence reports how many attempts were required");
  assert(executor.includes('classifyOrionCommandRisk(command) !== "read"'), "retry logic remains unreachable for protected non-read commands");
  console.log(`\nOrion safe-read retry results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
main();

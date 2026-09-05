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
  const verifier = read("lib/orion/autonomy/read-result-verifier.ts");
  const executor = read("lib/orion/autonomy/safe-read-executor.ts");

  console.log("\nOrion autonomous read result verifier contract");
  assert(verifier.includes('result.status !== "completed"'), "read verification requires completed execution");
  assert(verifier.includes("result.commandId !== command.id"), "read verification binds the result to the executed command");
  assert(verifier.includes("result.requiresConfirmation"), "read verification rejects unexpected confirmation requests");
  assert(verifier.includes("result.createdEntityIds.length > 0") && verifier.includes("result.updatedEntityIds.length > 0"), "read verification rejects entity side effects");
  assert(verifier.includes("result.publishedEventIds.length > 0"), "read verification rejects published side effects");
  assert(verifier.includes("result.entityCreated") && verifier.includes("result.entityUpdated") && verifier.includes("result.publishedEvent"), "legacy side-effect evidence is rejected too");
  assert(verifier.includes('href.startsWith("//")') && verifier.includes('startsWith("/api/")'), "read verification only permits internal non-API BOS hrefs");
  assert(verifier.includes("result.entityType !== command.entityType"), "read verification rejects unexpected entity types");
  assert(executor.includes("verifyOrionAutonomousReadResult"), "safe-read executor uses the dedicated semantic verifier");
  assert(executor.includes("verification.reason"), "semantic verification failure stops the sequence with an explicit reason");

  console.log(`\nOrion read verification results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

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
  const route = read("app/api/orion/command-center/route.ts");
  const fallback = read("lib/orion/intelligence/intent-fallback.ts");

  console.log("\nOrion live intelligence fallback contract");

  assert(route.includes("resolveOrionIntelligenceIntentFallback"), "command center imports the intelligence fallback");
  assert(route.includes("!result.suggestedCommand && !result.requiresClarification"), "deterministic Orion retains first priority");
  assert(route.includes("intelligenceFallback: true"), "fallback requests are explicitly traced");
  assert(route.includes("Preserve deterministic Orion behavior"), "OpenAI failure cannot take down deterministic Orion");
  assert(fallback.includes('statusCategory: "workflow_complete"'), "general answers reuse the existing spoken workflow response path");
  assert(fallback.includes('statusCategory: "workflow_collecting"'), "missing information returns a conversational collection state");
  assert(fallback.includes('command.id === "estimate.create"'), "estimate creation has a friendly guided-start fallback");
  assert(fallback.includes("Okay, starting a new estimate"), "estimate creation no longer falls into a red generic error");
  assert(fallback.includes("command.validate(action.params)"), "AI-selected BOS commands are validated before dispatch");
  assert(fallback.includes("resolveBosActionFromIntelligenceRoute"), "AI tool calls resolve back to the canonical BOS registry");

  console.log(`\nOrion live intelligence fallback results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

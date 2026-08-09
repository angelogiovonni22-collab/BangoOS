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
  const adapter = read("lib/orion/intelligence/openai-intelligence.ts");
  const route = read("app/api/orion/intelligence/route.ts");
  const policy = read("lib/orion/intelligence/orion-tool-router.ts");

  console.log("\nOrion OpenAI intelligence contract");

  assert(adapter.includes('process.env.OPENAI_API_KEY'), "OpenAI key remains server-side and environment controlled");
  assert(adapter.includes('client.responses.create'), "Orion general intelligence uses the Responses API");
  assert(adapter.includes('{ type: "web_search" }'), "Orion can use OpenAI web search for current external information");
  assert(adapter.includes('buildUniversalBosToolCatalog()'), "Orion exposes canonical BOS commands as model tools");
  assert(route.includes('resolveBosActionFromIntelligenceRoute'), "AI tool selections are resolved back to canonical BOS commands");
  assert(!route.includes('.from("') && !route.includes(".insert(") && !route.includes(".update("), "intelligence route cannot mutate BOS tables directly");
  assert(policy.includes("Never bypass BOS permissions, validation, confirmation levels, or audit logging."), "BOS execution safety remains outside model discretion");

  console.log(`\nOrion OpenAI intelligence results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

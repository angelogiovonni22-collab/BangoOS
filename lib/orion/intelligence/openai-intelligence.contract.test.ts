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
  const modelConfig = read("lib/orion/intelligence/model-config.ts");

  console.log("\nOrion OpenAI intelligence contract");

  assert(adapter.includes('process.env.OPENAI_API_KEY'), "OpenAI key remains server-side and environment controlled");
  assert(adapter.includes('client.responses.create'), "Orion general intelligence uses the Responses API");
  assert(adapter.includes('{ type: "web_search" }'), "Orion can use OpenAI web search for current external information");
  assert(adapter.includes('buildUniversalBosToolCatalog()'), "Orion exposes canonical BOS commands as model tools");
  assert(route.includes('resolveBosActionFromIntelligenceRoute'), "AI tool selections are resolved back to canonical BOS commands");
  assert(!route.includes('.from("') && !route.includes(".insert(") && !route.includes(".update("), "intelligence route cannot mutate BOS tables directly");
  assert(policy.includes("Never bypass BOS permissions, validation, confirmation levels, or audit logging."), "BOS execution safety remains outside model discretion");
  assert(modelConfig.includes('DEFAULT_REALTIME_MODEL = "gpt-realtime"'), "Orion v2 defaults to the public GPT Realtime API model");
  assert(modelConfig.includes('DEFAULT_REASONING_MODEL = "gpt-5.1"'), "Orion reasoning defaults to a public GPT API model");
  assert(modelConfig.includes('DEFAULT_FAST_MODEL = "gpt-5-mini"'), "Orion fast reasoning defaults to a public low-latency GPT API model");
  assert(modelConfig.includes('"gpt-realtime-2.1": DEFAULT_REALTIME_MODEL'), "stale Realtime model configuration is normalized safely");
  assert(modelConfig.includes('normalizeModel(readEnv("ORION_REALTIME_MODEL")'), "Realtime model remains environment-overridable with compatibility normalization");

  console.log(`\nOrion OpenAI intelligence results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

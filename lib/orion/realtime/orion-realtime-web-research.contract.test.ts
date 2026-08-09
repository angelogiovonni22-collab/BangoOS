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
  const session = read("app/api/orion/realtime/session/route.ts");
  const research = read("app/api/orion/realtime/research/route.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const intelligence = read("lib/orion/intelligence/openai-intelligence.ts");

  console.log("\nOrion Realtime web research contract");

  assert(session.includes('const RESEARCH_TOOL_NAME = "orion_web_research"'), "Realtime session exposes a dedicated research tool");
  assert(session.includes("current external information") && session.includes("web research"), "Realtime instructions route current external questions to research");
  assert(bridge.includes('ORION_REALTIME_RESEARCH_TOOL = "orion_web_research"'), "client bridge recognizes the research tool");
  assert(bridge.includes('/api/orion/realtime/research'), "research tool calls the authenticated Realtime research endpoint");
  assert(research.includes("resolveWorkspaceContext"), "research endpoint requires authenticated BOS workspace context");
  assert(research.includes("resolveOrionWithOpenAI"), "research endpoint reuses Orion general intelligence instead of bypassing it");
  assert(research.includes('result.route.kind === "bos_command"'), "research endpoint refuses to execute BOS operations through the research path");
  assert(intelligence.includes('{ type: "web_search" }'), "Orion intelligence can use OpenAI web search for current information");

  console.log(`\nOrion Realtime web research results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

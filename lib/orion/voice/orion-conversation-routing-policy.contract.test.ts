import fs from "node:fs";
import path from "node:path";
import { hasClearBosVoiceIntent, shouldPreferOrionConversation } from "./voice-routing-policy";

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

  console.log("\nOrion conversation-first voice routing contract");

  for (const phrase of [
    "can you hear me?",
    "are you there?",
    "how are you?",
    "what can you do?",
    "thank you",
    "why is the sky blue?",
  ]) {
    assert(shouldPreferOrionConversation(phrase), `conversation stays out of deterministic BOS routing: ${phrase}`);
  }

  for (const phrase of [
    "open customers",
    "go to estimates",
    "create a new estimate",
    "show me today's schedule",
    "what projects are active",
    "what is the health of this project",
  ]) {
    assert(hasClearBosVoiceIntent(phrase), `explicit BOS request remains identifiable as BOS intent: ${phrase}`);
    assert(!shouldPreferOrionConversation(phrase), `BOS request is not forced into conversation-only mode: ${phrase}`);
  }

  const llmFirstMarker = "const llmFirst = await resolveOrionIntelligenceIntentFallback";
  const operationalMarker = "const operationalHandled = await resolveOperationalVoiceIntent";
  const deterministicMarker = "const result = await resolveOrionIntent";

  assert(route.includes("conversationOnly: shouldPreferOrionConversation(normalizedIntentInput.input)"), "voice API sends conversational turns through the LLM with a non-executable safety mode");
  assert(route.indexOf(llmFirstMarker) >= 0 && route.indexOf(llmFirstMarker) < route.indexOf(operationalMarker), "LLM-first routing runs before legacy operational routing");
  assert(route.indexOf(llmFirstMarker) >= 0 && route.indexOf(llmFirstMarker) < route.indexOf(deterministicMarker), "LLM-first routing runs before generic deterministic intent resolution");
  assert(route.includes("resolveOrionIntelligenceIntentFallback") && route.includes("llmFirst: true"), "LLM-first voice routing is observable in diagnostics");

  console.log(`\nOrion conversation routing results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

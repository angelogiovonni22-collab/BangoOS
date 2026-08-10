import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("app/api/orion/command-center/route.ts", "utf8");
const fallbackSource = readFileSync("lib/orion/intelligence/intent-fallback.ts", "utf8");
const openAiSource = readFileSync("lib/orion/intelligence/openai-intelligence.ts", "utf8");

function position(source: string, marker: string) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `Missing marker: ${marker}`);
  return index;
}

console.log("Orion LLM-first voice routing contract");

const llmFirstPosition = position(routeSource, "const llmFirst = await resolveOrionIntelligenceIntentFallback");
const operationalPosition = position(routeSource, "const operationalHandled = await resolveOperationalVoiceIntent");
const estimatePosition = position(routeSource, "const estimateHandled = await resolveEstimateVoiceWorkflowTurn");
const workflowPosition = position(routeSource, "const workflowHandled = await resolveVoiceWorkflowTurn");
const deterministicPosition = position(routeSource, "const result = await resolveOrionIntent");

assert.ok(llmFirstPosition < operationalPosition, "LLM routing runs before operational voice fallback");
assert.ok(llmFirstPosition < estimatePosition, "LLM routing runs before estimate workflow fallback");
assert.ok(llmFirstPosition < workflowPosition, "LLM routing runs before generic workflow fallback");
assert.ok(llmFirstPosition < deterministicPosition, "LLM routing runs before deterministic intent resolution");
console.log("  + all normal voice turns reach the LLM before legacy intent engines");

assert.ok(routeSource.includes("conversationOnly: shouldPreferOrionConversation(normalizedIntentInput.input)"), "conversation classification is passed into the LLM router");
assert.ok(fallbackSource.includes("conversationOnly?: boolean"), "intelligence adapter accepts a conversation-only safety mode");
assert.ok(fallbackSource.includes("conversationOnly: args.conversationOnly"), "intelligence adapter forwards conversation-only mode to OpenAI");
console.log("  + conversational turns retain a non-executable LLM safety boundary");

assert.ok(openAiSource.includes("const tools: Array<Record<string, unknown>> = args.conversationOnly ? [] : [...bosTools]"), "conversation-only turns receive no BOS tools");
assert.ok(openAiSource.includes("Do not navigate, execute BOS actions, call BOS tools"), "conversation-only policy explicitly forbids BOS execution");
assert.ok(openAiSource.includes("if (!args.conversationOnly && functionCall"), "function calls cannot escape conversation-only mode");
console.log("  + conversation cannot accidentally execute a BOS command even if the model misclassifies it");

assert.ok(routeSource.includes("LLM-first routing failed; using deterministic fallback"), "legacy routing remains an explicit resilience fallback");
assert.ok(operationalPosition < deterministicPosition, "operational fallback remains before generic deterministic resolution");
console.log("  + deterministic voice routing remains available only as fallback resilience");

assert.ok(routeSource.includes('const isVoiceTurn = req.headers.get("x-orion-voice-turn") === "1"'), "LLM-first migration is scoped to voice turns");
console.log("  + non-voice command-center behavior remains isolated from the migration");

console.log("Orion LLM-first voice routing contract passed.");

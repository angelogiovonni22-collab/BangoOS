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
  const continuation = read("lib/orion/voice/conversation-continuation.ts");
  const response = read("lib/orion/voice/voice-response.ts");
  const wake = read("lib/orion/voice/wake-word-normalizer.ts");
  const session = read("lib/orion/voice/voice-session.ts");
  const speech = read("lib/orion/voice/speech-output-adapter.ts");
  const estimate = read("lib/orion/workflows/estimate-voice-workflow.ts");
  const intelligence = read("lib/orion/intelligence/intent-fallback.ts");
  const commandCenter = read("app/api/orion/command-center/route.ts");

  console.log("\nOrion conversational follow-up contract");

  assert(continuation.includes("DEFAULT_CONTINUATION_TTL_MS = 30_000"), "follow-up allowance is temporary");
  assert(continuation.includes("consumeOrionConversationContinuation"), "follow-up allowance is one-shot consumable");
  assert(response.includes('armOrionConversationContinuation("workflow_follow_up")'), "spoken workflow questions arm continuation");
  assert(response.includes('armOrionConversationContinuation("clarification")'), "clarification prompts arm continuation");
  assert(response.includes('armOrionConversationContinuation("confirmation")'), "confirmation prompts arm continuation");
  assert(wake.includes("consumeOrionConversationContinuation()"), "wake detector consumes conversational continuation");
  assert(wake.includes("cleanedCommand: transcript"), "follow-up speech is forwarded as the command without another wake phrase");
  assert(wake.includes("clearOrionConversationContinuation();"), "an explicit wake phrase clears stale continuation state");
  assert(speech.includes('ORION_SPEECH_ENDED_EVENT = "orion:speech-ended"'), "speech adapter publishes a single completion handoff");
  assert(session.includes("hasOrionConversationContinuation()"), "voice session checks whether Orion is awaiting a conversational reply");
  assert(session.includes("window.addEventListener(ORION_SPEECH_ENDED_EVENT, onSpeechEnded)"), "voice session listens for Orion speech completion");
  assert(session.includes("conversation.follow_up.microphone_resume") && session.includes("start();"), "microphone automatically resumes after a follow-up question");
  assert(estimate.includes("beginEstimateVoiceWorkflowSession") && estimate.includes("hasActiveEstimateVoiceWorkflowSession"), "estimate workflow exposes persistent conversational session boundaries");
  assert(intelligence.includes("beginEstimateVoiceWorkflowSession(args.workspace)"), "LLM-first estimate creation opens the stateful estimate workflow");
  assert(commandCenter.includes("hasActiveEstimateVoiceWorkflowSession(context.workspace)"), "active estimate follow-ups bypass fresh LLM intent classification");
  assert(commandCenter.indexOf("hasActiveEstimateVoiceWorkflowSession(context.workspace)") < commandCenter.indexOf("const llmFirst = await resolveOrionIntelligenceIntentFallback"), "stateful estimate continuation runs before LLM-first routing");

  console.log(`\nOrion conversational follow-up results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

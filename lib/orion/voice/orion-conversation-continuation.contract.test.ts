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

  console.log("\nOrion conversational follow-up contract");

  assert(continuation.includes("DEFAULT_CONTINUATION_TTL_MS = 30_000"), "follow-up allowance is temporary");
  assert(continuation.includes("consumeOrionConversationContinuation"), "follow-up allowance is one-shot consumable");
  assert(response.includes('armOrionConversationContinuation("workflow_follow_up")'), "spoken workflow questions arm continuation");
  assert(response.includes('armOrionConversationContinuation("clarification")'), "clarification prompts arm continuation");
  assert(response.includes('armOrionConversationContinuation("confirmation")'), "confirmation prompts arm continuation");
  assert(wake.includes("consumeOrionConversationContinuation()"), "wake detector consumes conversational continuation");
  assert(wake.includes("cleanedCommand: transcript"), "follow-up speech is forwarded as the command without another wake phrase");
  assert(wake.includes("clearOrionConversationContinuation();"), "an explicit wake phrase clears stale continuation state");

  console.log(`\nOrion conversational follow-up results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();

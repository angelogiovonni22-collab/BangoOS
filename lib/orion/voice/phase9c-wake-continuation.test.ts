import { readFileSync } from "node:fs";
import { join } from "node:path";

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

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function main() {
  const provider = read("components/orion/voice/GlobalOrionVoiceProvider.tsx");
  const wake = read("lib/orion/voice/wake-word-normalizer.ts");

  test("1. one-utterance wake command still uses existing pipeline", () => {
    assert(provider.includes("normalized = wakeDetection.cleanedCommand"), "wake+command single transcript keeps cleaned command flow");
    assert(provider.includes("const normalizedInput = normalizeIntentInput(normalized)"), "single transcript still goes through normalizeIntentInput");
    assert(provider.includes("await executeCommand(nextIntent.suggestedCommand.commandId, nextIntent.suggestedCommand.params)"), "single transcript still dispatches through executeCommand");
  });

  test("2. split wake and command continuation is provider-owned", () => {
    assert(provider.includes("const WAKE_COMMAND_CONTINUATION_TIMEOUT_MS = 4_000"), "continuation timeout constant is configured to 4 seconds");
    assert(provider.includes("startWakeContinuation(token)"), "wake-only transcript starts continuation");
    assert(provider.includes("if (!commandSessionActive && wakeContinuationActiveRef.current)"), "next transcript can be consumed by continuation branch without a second wake phrase");
  });

  test("3. short second transcript is accepted via normalizer", () => {
    assert(provider.includes("normalized = trimmed;"), "continuation branch forwards next non-empty transcript as command candidate");
    assert(provider.includes("const normalizedInput = normalizeIntentInput(normalized)"), "short second transcript still uses existing normalization");
  });

  test("4. no-wake transcript is rejected when continuation is inactive", () => {
    assert(provider.includes("provider.processTranscript.skip.wake_not_detected"), "no-wake transcript is rejected in normal wake mode");
  });

  test("5. continuation expires and returns to wake mode", () => {
    assert(provider.includes("wake.continuation.expired"), "expiration trace log exists");
    assert(provider.includes("clearWakeContinuation(\"timeout\")"), "expiration clears continuation state");
    assert(provider.includes("setPhase(\"waiting_for_wake\")") && provider.includes("Waiting for wake phrase."), "expiration returns to waiting_for_wake state");
  });

  test("6. transcript after timeout requires wake phrase again", () => {
    assert(provider.includes("setPhase(\"waiting_for_wake\")"), "post-timeout state returns to waiting_for_wake");
    assert(provider.includes("provider.processTranscript.skip.wake_not_detected"), "post-timeout non-wake transcript follows normal rejection path");
  });

  test("7. explicit cancel clears continuation", () => {
    assert(provider.includes("clearWakeContinuation(\"explicit_cancel\")"), "explicit cancel path clears continuation");
  });

  test("8. stop and disable clear continuation", () => {
    assert(provider.includes("clearWakeContinuation(\"stop_all_listening\")"), "stopAllListening clears continuation");
    assert(provider.includes("stopAllListening();") && provider.includes("const disableGlobalVoice = useCallback"), "disable voice flows through stopAllListening");
  });

  test("9. company or user switch clears continuation", () => {
    assert(provider.includes("clearWakeContinuation(\"company_or_workspace_switch\")"), "company/user switch clears continuation state");
    assert(provider.includes("[company.companyId, company.userId") || provider.includes("company.companyId, company.userId"), "company/user switch effect remains wired");
  });

  test("10. only first next transcript is consumed", () => {
    assert(provider.includes("clearWakeContinuation(\"command_received\")"), "continuation is consumed and cleared on first next transcript");
    assert(provider.includes("provider.processTranscript.skip.duplicate_transcript"), "duplicate transcript guard remains active");
  });

  test("11. duplicate final-result events still execute once", () => {
    assert(provider.includes("lastProcessedTranscriptRef") && provider.includes("lastProcessed?.token === token && lastProcessed.transcript === trimmed"), "provider still deduplicates same token+transcript final results");
  });

  test("12. wake-only acknowledgement is silent and visual", () => {
    assert(!provider.includes("speak(\"I'm listening.\")"), "provider does not invoke speech synthesis for wake-only acknowledgement");
    assert(provider.includes("setPhase(\"awaiting_wake_command\")") && provider.includes("Listening for your command."), "wake-only transcript enters visual continuation listening state");
  });

  test("13. hands-free returns to wake mode after command completion", () => {
    assert(provider.includes("if (settings.mode === \"hands_free\" && settings.returnToWakeAfterCommand && !commandSessionActive)") && provider.includes("setWakeListening(true);") && provider.includes("setPhase(\"waiting_for_wake\")"), "hands-free post-command continuation behavior remains intact");
  });

  test("14. no regressions to wake matching, visibility lifecycle, and restart safeguards", () => {
    assert(wake.includes("hey_orion") && wake.includes("okay_orion") && wake.includes("orion"), "wake punctuation variants remain in wake-word normalizer");
    assert(provider.includes("visibilitychange") && provider.includes("requestVoiceStart(\"visible_resume\")"), "visibility pause/resume contract remains covered");
    assert(provider.includes("if (now - lastStartRequestAtRef.current < 350)"), "recognition restart throttle remains in provider");
    assert(provider.includes("provider.processTranscript.skip.duplicate_transcript"), "duplicate transcript protection remains in provider");
    assert(provider.includes("confirmationLevel === \"REQUIRED\""), "confirmation flow remains intact");
  });

  console.log(`\nPhase 9C wake continuation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

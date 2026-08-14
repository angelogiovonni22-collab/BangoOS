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

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const provider = read("components/orion/voice/GlobalOrionVoiceProvider.tsx");
  const speechAdapter = read("lib/orion/voice/speech-output-adapter.ts");

  test("1. workflow statuses bypass no-match guard and use speech pipeline", () => {
    const workflowBranch = provider.indexOf("workflowStatus.startsWith(\"workflow_\")");
    const noMatchGuard = provider.indexOf("if (!nextIntent.suggestedCommand || !nextIntent.commandPreview)");

    assert(workflowBranch >= 0, "provider contains workflow status branch");
    assert(noMatchGuard >= 0, "provider retains existing no-match guard");
    assert(workflowBranch < noMatchGuard, "workflow branch executes before no-match guard");
    assert(provider.includes('workflowStatus === "workflow_collecting"'), "workflow_collecting is explicitly handled");
    assert(provider.includes('workflowStatus === "workflow_awaiting_confirmation"'), "workflow_awaiting_confirmation is explicitly handled");
    assert(provider.includes('workflowStatus === "workflow_complete"') || provider.includes('workflowStatus === "workflow_completed"'), "workflow completion status is explicitly handled");
  });

  test("2. workflow path speaks intent message through requestSpokenResponse", () => {
    assert(provider.includes("const workflowMessage = nextIntent.message || \"Workflow step ready.\";"), "workflow branch selects intent.message for response text");
    assert(provider.includes("requestSpokenResponse({") && provider.includes('status: "success"') && provider.includes("message: workflowMessage"), "workflow branch calls requestSpokenResponse with workflow message");
    assert(provider.includes("const requestSpokenResponse = useCallback((request: OrionSpeechResponseRequest) => {") && provider.includes("buildVoiceResponse({"), "requestSpokenResponse routes through buildVoiceResponse");
  });

  test("3. no-match behavior remains unchanged for real no-match", () => {
    assert(provider.includes("if (!nextIntent.suggestedCommand || !nextIntent.commandPreview) {"), "no-match guard condition remains present");
    assert(provider.includes('setPhase("no_match");'), "no-match still sets no_match phase");
    assert(provider.includes('setErrorCategory("no_match");'), "no-match still sets no_match error category");
  });

  test("4. suggestedCommand execution path remains unchanged", () => {
    assert(provider.includes("if (nextIntent.commandPreview.confirmationLevel === \"REQUIRED\")"), "confirmation-required execution branch remains present");
    assert(provider.includes("await executeCommand(nextIntent.suggestedCommand.commandId, nextIntent.suggestedCommand.params);"), "suggestedCommand execute path remains present");
  });

  test("5. speech adapter invocation and speaking lifecycle remain single-path", () => {
    assert(provider.includes("const didSpeak = speechAdapterRef.current.speak(trimmed"), "provider uses existing speech adapter speak call");
    assert(provider.includes("if (!didSpeak) {") && provider.includes("reason: \"adapter_rejected\""), "provider handles single speak call rejection path");
    assert(speechAdapter.includes("synth.speak(utterance);"), "adapter invokes browser speechSynthesis.speak");
  });

  test("6. listening resume is gated by speech completion", () => {
    assert(provider.includes("if (speechActive) {") && provider.includes('if (phase !== "speaking") {') && provider.includes('setPhase("speaking");'), "provider keeps speaking state active while speech is active");
    assert(provider.includes('if (phase !== "speaking") {') && provider.includes("return;"), "provider exits resume effect until speaking phase transitions");
    assert(provider.includes("if (settings.enabled && settings.mode === \"hands_free\" && settings.returnToWakeAfterCommand && !commandSessionActive) {") && provider.includes('setPhase("waiting_for_wake");'), "provider resumes listening flow after speaking effect completion");
  });

  console.log(`\nPhase 11C workflow prompt speech handoff results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

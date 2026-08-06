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
  const overlay = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");
  const persistentPanel = read("components/orion/persistent/PersistentOrionPanel.tsx");
  const voiceSession = read("lib/orion/voice/voice-session.ts");
  const globalProvider = read("components/orion/voice/GlobalOrionVoiceProvider.tsx");
  const settingsPanel = read("components/orion/voice/OrionVoiceSettingsPanel.tsx");

  test("1. explicit user activation", () => {
    assert(overlay.includes("<OrionVoiceButton"), "overlay has voice push-to-talk button");
    assert(overlay.includes("onStart={() => {") && overlay.includes("voice.start()"), "voice starts from explicit button action");
  });

  test("2. listening state transitions", () => {
    assert(voiceSession.includes("setState(\"requesting_permission\")"), "session sets requesting_permission before start");
    assert(voiceSession.includes("setState(\"listening\")"), "session enters listening state on start");
    assert(voiceSession.includes("setState(\"processing\")"), "session enters processing state on final transcript");
  });

  test("3. interim and final transcripts", () => {
    assert(voiceSession.includes("setInterimTranscript"), "session captures interim transcript");
    assert(voiceSession.includes("setFinalTranscript"), "session captures final transcript");
    assert(overlay.includes("setQuery(trimmed);") || overlay.includes("setQuery(transcript);"), "final transcript is routed to command center input");
  });

  test("4. intent integration", () => {
    assert(overlay.includes("mode: \"intent\""), "voice flow uses intent mode endpoint");
    assert(overlay.includes("/api/orion/command-center"), "voice flow calls command center API");
  });

  test("5. no direct business service calls", () => {
    assert(!overlay.includes("from(\""), "overlay does not query tables directly");
    assert(!overlay.includes("createOrionTimelineService"), "overlay does not call business services directly");
  });

  test("6. clarification and candidate selection", () => {
    assert(overlay.includes("requiresClarification"), "voice flow handles intent ambiguity");
    assert(overlay.includes("resolveSpokenCandidate"), "voice flow supports spoken candidate selection");
  });

  test("7. required confirmation and phrase parsing", () => {
    assert(overlay.includes("confirmationLevel === \"REQUIRED\""), "voice flow enforces required confirmations");
    assert(overlay.includes("parseVoiceConfirmationPhrase"), "voice flow parses confirmation phrases");
    assert(overlay.includes("isCancelPhrase"), "voice flow parses cancel phrases");
  });

  test("8. spoken response mute behavior", () => {
    assert(overlay.includes("voice.setMuted(") && overlay.includes("Mute Voice"), "voice mute toggle exists");
    assert(globalProvider.includes("(!settings.spokenResponsesEnabled && !options?.force) || !voice.support.synthesisSupported"), "spoken responses are blocked when muted/disabled or synthesis is unsupported");
  });

  test("9. overlay-close and visibility stop", () => {
    assert(overlay.includes("if (!open) {") && overlay.includes("voice.cancel();"), "overlay close stops voice capture");
    assert(globalProvider.includes("addEventListener(\"visibilitychange\", onVisibility)"), "global provider handles document hidden events");
    assert(!voiceSession.includes("addEventListener(\"visibilitychange\""), "voice session does not duplicate hidden-tab listener");
  });

  test("10. persistent panel voice entry point", () => {
    assert(persistentPanel.includes("<OrionVoiceButton"), "persistent Orion panel has voice button");
    assert(persistentPanel.includes("showNotice"), "persistent panel shows privacy notice");
  });

  test("10b. overlay supports tap-to-listen and hands-free controls", () => {
    assert(overlay.includes("Mode:") && overlay.includes("tap_to_listen"), "overlay includes tap-to-listen mode state");
    assert(overlay.includes("OrionHandsFreeToggle"), "overlay includes hands-free toggle");
    assert(overlay.includes("OrionWakeStatus"), "overlay includes wake status UI");
    assert(overlay.includes("OrionMicrophoneIndicator"), "overlay includes microphone indicator");
  });

  test("11. accessibility labels and live regions", () => {
    assert(overlay.includes("aria-live=\"polite\""), "voice visual output includes live region");
    assert(read("components/orion/voice/OrionVoiceButton.tsx").includes("aria-label={`Push to talk with Orion"), "microphone has accessible label");
  });

  test("12. no raw audio persistence", () => {
    assert(!voiceSession.includes("indexedDB"), "voice session does not persist raw data in indexedDB");
    assert(!voiceSession.includes("blob"), "voice session does not store audio blobs");
    assert(!voiceSession.includes("MediaRecorder"), "voice session does not use raw audio recorder");
  });

  test("13. final transcript is processed once and immediately", () => {
    assert(voiceSession.includes("lastDeliveredFinalTranscriptRef"), "voice session tracks last delivered final transcript");
    assert(voiceSession.includes("lastDeliveredFinalTranscriptRef.current !== joined"), "voice session deduplicates repeated final transcript delivery");
    assert(voiceSession.includes("onFinalTranscriptRef.current?.(joined)"), "voice session forwards final transcript directly from recognition result");
  });

  test("14. voice request avoids duplicate intent resolution calls", () => {
    assert(overlay.includes("skipNextDebouncedIntentRef"), "overlay tracks next debounced intent skip for voice input");
    assert(overlay.includes("skipNextDebouncedIntentRef.current = true") && overlay.includes("skipNextDebouncedIntentRef.current = false"), "voice transcript suppresses duplicate debounced intent request");
  });

  test("15. canonical voice status phases are present", () => {
    assert(overlay.includes('type OrionVoiceUiState =') && overlay.includes('"understanding"') && overlay.includes('"executing"') && overlay.includes('"waiting_for_wake"'), "overlay defines canonical voice UI states");
    assert(overlay.includes('setVoiceStatusMessage("Understanding...")'), "overlay shows immediate Understanding status after microphone release");
  });

  test("16. voice settings panel supports persistent voice preferences", () => {
    assert(settingsPanel.includes("Spoken responses") && settingsPanel.includes("Preview voice"), "settings panel exposes spoken toggle and preview");
    assert(settingsPanel.includes("Rate") && settingsPanel.includes("Pitch") && settingsPanel.includes("Volume"), "settings panel exposes speech tuning controls");
    assert(globalProvider.includes("setVoiceId") && globalProvider.includes("previewVoice"), "global provider exposes voice selection and preview controls");
  });

  console.log(`\nPhase 7D voice UI contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

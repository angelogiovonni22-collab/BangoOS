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
  const config = read("lib/orion/runtime-config.ts");

  test("1. canonical operational voice config exists", () => {
    assert(config.includes("ORION_VOICE_FREEZE_MESSAGE"), "runtime config exposes shared pause message");
    assert(config.includes("isOrionVoiceAutomationEnabled"), "runtime config exposes shared automation gate helper");
    assert(config.includes('process.env.NEXT_PUBLIC_ORION_VOICE_AUTOMATION !== "0"'), "automation gate defaults to enabled unless emergency kill switch is explicitly set to 0");
  });

  test("2. provider reads canonical flag once", () => {
    assert(provider.includes("isOrionVoiceAutomationEnabled") && provider.includes("ORION_VOICE_FREEZE_MESSAGE"), "provider imports canonical runtime gate");
    assert(provider.includes("const voiceAutomationEnabled = isOrionVoiceAutomationEnabled();"), "provider derives one canonical automation flag");
  });

  test("3. microphone startup and restart paths retain emergency gating", () => {
    assert(provider.includes("const requestVoiceStart = useCallback") && provider.includes("if (!voiceAutomationEnabled) {") && provider.includes("voiceStartRef.current();"), "requestVoiceStart respects emergency kill switch before microphone start");
    assert(provider.includes("const startVoiceCapture = useCallback") && provider.includes("setStatusMessage(ORION_VOICE_FREEZE_MESSAGE);"), "manual start path reports paused status when kill switch is active");
    assert(provider.includes("requestVoiceStart(\"hands_free\")"), "hands-free idle restart remains routed through gated requestVoiceStart");
  });

  test("4. wake continuation and transcript workflow requests retain emergency gating", () => {
    assert(provider.includes("const startWakeContinuation = useCallback") && provider.includes("if (!voiceAutomationEnabled) {") && provider.includes("setStatusMessage(ORION_VOICE_FREEZE_MESSAGE);"), "wake continuation flow retains emergency guard");
    assert(provider.includes("const handleTranscript = useCallback") && provider.includes("if (!voiceAutomationEnabled) {") && provider.includes("setStatusMessage(ORION_VOICE_FREEZE_MESSAGE);"), "transcript handler exits early only while kill switch is active");
    assert(provider.includes('fetch("/api/orion/command-center"') && provider.includes("if (!settings.enabled || !voiceAutomationEnabled)"), "voice intent request path respects emergency kill switch");
  });

  test("5. background loops and auto lifecycle paths retain emergency gating", () => {
    assert(provider.includes("if (!settings.enabled || !voiceAutomationEnabled) {") && provider.includes("void fetchCatalog();"), "background catalog refresh is disabled only when Orion is off or paused");
    assert(provider.includes("if (!settings.enabled || !commandSessionActive || !voiceAutomationEnabled)"), "inactivity timer loop respects emergency kill switch");
    assert(provider.includes("if (!voiceAutomationEnabled) {") && provider.includes("document.addEventListener(\"visibilitychange\", onVisibility);"), "visibility-driven resume path short-circuits while paused");
  });

  test("6. UI state remains honest when emergency kill switch is active", () => {
    assert(provider.includes("setPhase(\"disabled\")"), "emergency gate forces disabled phase");
    assert(provider.includes("setErrorCategory(null);") && provider.includes("setStatusMessage(ORION_VOICE_FREEZE_MESSAGE);"), "emergency gate clears error category and shows paused status");
    assert(provider.includes("const effectiveSettings = voiceAutomationEnabled") && provider.includes("{ ...settings, enabled: false }"), "context publishes effective disabled setting while paused");
  });

  console.log(`\nPhase 11D Orion operational voice gate results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

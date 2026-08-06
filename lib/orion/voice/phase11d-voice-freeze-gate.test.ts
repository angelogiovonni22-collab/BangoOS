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

  test("1. canonical freeze config exists", () => {
    assert(config.includes("ORION_VOICE_FREEZE_MESSAGE"), "runtime config exposes shared freeze message");
    assert(config.includes("isOrionVoiceAutomationEnabled"), "runtime config exposes shared automation gate helper");
    assert(config.includes("process.env.NEXT_PUBLIC_ORION_VOICE_AUTOMATION === \"1\""), "automation gate defaults to disabled unless env flag is explicitly enabled");
  });

  test("2. provider reads canonical flag once", () => {
    assert(provider.includes("isOrionVoiceAutomationEnabled") && provider.includes("ORION_VOICE_FREEZE_MESSAGE"), "provider imports canonical runtime gate");
    assert(provider.includes("const voiceAutomationEnabled = isOrionVoiceAutomationEnabled();"), "provider derives one canonical automation flag");
  });

  test("3. microphone startup and restart paths are gated", () => {
    assert(provider.includes("const requestVoiceStart = useCallback") && provider.includes("if (!voiceAutomationEnabled) {") && provider.includes("voiceStartRef.current();"), "requestVoiceStart uses gate before microphone start");
    assert(provider.includes("const startVoiceCapture = useCallback") && provider.includes("setStatusMessage(ORION_VOICE_FREEZE_MESSAGE);"), "manual start path reports freeze status");
    assert(provider.includes("requestVoiceStart(\"hands_free\")"), "hands-free idle restart remains routed through gated requestVoiceStart");
  });

  test("4. wake continuation and transcript workflow requests are gated", () => {
    assert(provider.includes("const startWakeContinuation = useCallback") && provider.includes("if (!voiceAutomationEnabled) {") && provider.includes("setStatusMessage(ORION_VOICE_FREEZE_MESSAGE);"), "wake continuation flow has freeze guard");
    assert(provider.includes("const handleTranscript = useCallback") && provider.includes("if (!voiceAutomationEnabled) {") && provider.includes("setStatusMessage(ORION_VOICE_FREEZE_MESSAGE);"), "transcript handler exits early while frozen");
    assert(provider.includes('fetch("/api/orion/command-center"') && provider.includes("if (!settings.enabled || !voiceAutomationEnabled)"), "voice intent request path is blocked when frozen");
  });

  test("5. background loops and auto lifecycle paths are gated", () => {
    assert(provider.includes("if (!settings.enabled || !voiceAutomationEnabled) {") && provider.includes("void fetchCatalog();"), "background catalog refresh is disabled while frozen");
    assert(provider.includes("if (!settings.enabled || !commandSessionActive || !voiceAutomationEnabled)"), "inactivity timer loop is disabled while frozen");
    assert(provider.includes("if (!voiceAutomationEnabled) {") && provider.includes("document.addEventListener(\"visibilitychange\", onVisibility);"), "visibility-driven resume path short-circuits while frozen");
  });

  test("6. UI state remains honest and non-error while frozen", () => {
    assert(provider.includes("setPhase(\"disabled\")"), "freeze gate forces disabled phase");
    assert(provider.includes("setErrorCategory(null);") && provider.includes("setStatusMessage(ORION_VOICE_FREEZE_MESSAGE);"), "freeze gate clears error category and shows temporary disabled status");
    assert(provider.includes("const effectiveSettings = voiceAutomationEnabled") && provider.includes("{ ...settings, enabled: false }"), "context publishes effective disabled setting while frozen");
  });

  console.log(`\nPhase 11D Orion voice freeze gate results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

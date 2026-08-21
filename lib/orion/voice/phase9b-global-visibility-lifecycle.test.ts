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

function countMatches(source: string, pattern: RegExp) {
  return (source.match(pattern) || []).length;
}

function main() {
  const provider = read("components/orion/voice/GlobalOrionVoiceProvider.tsx");
  const voiceSession = read("lib/orion/voice/voice-session.ts");
  const persistentOrion = read("components/orion/persistent/PersistentOrion.tsx");
  const overlay = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");

  test("1. visible document does not pause voice", () => {
    assert(provider.includes("const hidden = document.hidden || document.visibilityState === \"hidden\""), "provider derives hidden from hidden or visibilityState");
    assert(provider.includes("if (hidden) {") && provider.includes("Voice paused while tab is hidden."), "pause message is only in hidden branch");
    assert(!provider.includes("if (document.visibilityState === \"visible\") {\n        voice.stop"), "provider does not stop on visible state");
  });

  test("2. actual hidden document hard-pauses voice and suppresses late output", () => {
    assert(provider.includes("hiddenPauseRef.current = true;"), "provider marks hidden-pause flag");
    assert(provider.includes("voiceStopRef.current();") && provider.includes("voiceCancelRef.current();"), "provider stops and cancels recognition when hidden");
    assert(provider.includes("speechAdapterRef.current.cancel();"), "provider cancels speech output when hidden");
    assert(provider.includes("inFlightIntentRef.current?.abort();") && provider.includes("inFlightExecuteRef.current?.abort();"), "provider aborts in-flight Orion work when hidden");
    assert(provider.includes("provider.processTranscript.skip.inactive_bos_tab"), "late transcript processing is blocked while BOS is not the active tab");
    assert(provider.includes("reason: \"inactive_bos_tab\""), "speech output is blocked while BOS is not the active tab");
    assert(provider.includes("setPhase(\"stopping\")"), "provider enters stopping while hidden");
  });

  test("3. DevTools/window blur does not pause voice", () => {
    assert(!provider.includes("window.addEventListener(\"blur\""), "provider does not pause on window blur");
    assert(!provider.includes("window.addEventListener(\"focus\""), "provider does not pause on window focus");
    assert(!provider.includes("pagehide"), "provider does not use pagehide for voice pausing");
    assert(!provider.includes("pageshow"), "provider does not use pageshow for voice pausing");
  });

  test("4. closing Persistent Orion panel does not pause voice", () => {
    assert(persistentOrion.includes("onClose={() => setOpen(false)}"), "panel close only updates panel open state");
    assert(!persistentOrion.includes("onClose={() => voice.stopAllListening()}"), "panel close does not stop voice session");
  });

  test("5. closing Command Center does not pause voice", () => {
    assert(overlay.includes("const cancelVoice = () => {") && overlay.includes("Command center close should not stop global voice session."), "overlay close cancellation hook is explicitly no-op for global voice");
    assert(!overlay.includes("handleClose() {\n    globalVoice.stopAllListening();"), "overlay close does not stop global voice");
  });

  test("6. normal route change does not pause voice", () => {
    assert(provider.includes("void fetchCatalog();"), "route updates refresh context via catalog fetch");
    assert(!provider.includes("setStatusMessage(\"Workspace changed. Voice paused while tab is hidden.\")"), "route context effect does not force hidden-tab pause message");
  });

  test("7. returning visible resumes when allowed", () => {
    assert(provider.includes("logGlobalVisibility(\"visible resume requested\")"), "provider logs visible resume requests");
    assert(provider.includes("const canAttemptResume = modeRequiresListening"), "provider gates resume on enabled/mode/permission/restart conditions");
    assert(provider.includes("requestVoiceStart(\"visible_resume\")"), "provider attempts resume only from visible handler");
  });

  test("8. blocked visible restart enters reactivation_required", () => {
    assert(provider.includes("setPhase(\"reactivation_required\")"), "provider can enter reactivation_required phase");
    assert(provider.includes("setErrorCategory(\"reactivation_required\")"), "provider exposes reactivation_required error category");
    assert(provider.includes("logGlobalVisibility(\"reactivation required\")"), "provider logs reactivation-required transitions");
  });

  test("9. one visibility listener only", () => {
    assert(countMatches(provider, /addEventListener\("visibilitychange", onVisibility\)/g) === 1, "provider registers one visibilitychange listener");
    assert(countMatches(voiceSession, /addEventListener\("visibilitychange"/g) === 0, "voice session no longer registers a visibility listener");
  });

  test("10. listener cleanup uses same callback reference", () => {
    assert(provider.includes("document.removeEventListener(\"visibilitychange\", onVisibility);"), "cleanup removes the same onVisibility callback");
  });

  test("11. duplicate recognition starts are guarded", () => {
    assert(provider.includes("if (now - lastStartRequestAtRef.current < 350)"), "start requests are throttled");
    assert(provider.includes("voiceStateRef.current === \"requesting_permission\" || voiceStateRef.current === \"listening\" || voiceStateRef.current === \"processing\""), "start helper guards active recognition states");
    assert(countMatches(provider, /requestVoiceStart\("manual"\)|requestVoiceStart\("hands_free"\)|requestVoiceStart\("visible_resume"\)/g) >= 3, "all start paths use shared guarded helper");
  });

  test("12. sign-out/company-switch still stops voice", () => {
    assert(provider.includes("voice.cancel();") && provider.includes("Workspace changed. Voice paused."), "company/user switch still cancels active voice");
    assert(provider.includes("[company.companyId, company.userId]"), "company/user switch effect remains active");
  });

  test("13. explicit disable persists off state until manual re-enable", () => {
    assert(provider.includes("const disableGlobalVoice = useCallback"), "manual disable callback exists");
    assert(provider.includes("stopAllListening();"), "manual disable path still stops all listening");
    assert(provider.includes("\"disable_global_voice\""), "spoken disable has a dedicated local control phrase");
    assert(provider.includes("\"disable\",") && provider.includes("\"turn off orion\""), "spoken disable accepts the requested phrase and natural variants");
    assert(provider.includes("provider.processTranscript.control_phrase_disable"), "spoken disable is handled before normal intent routing");
    assert(provider.includes("const next = { ...settingsRef.current, enabled: false };"), "spoken disable persists the global enabled flag as false");
    assert(provider.includes("setStatusMessage(\"Global Orion Voice is disabled.\")"), "disable path keeps disabled status message");
  });

  test("14. visibility diagnostics log shape", () => {
    assert(provider.includes("logGlobalVisibility(\"visibilitychange\""), "provider emits visibilitychange diagnostics");
    assert(provider.includes("hidden,") && provider.includes("visibilityState: document.visibilityState") && provider.includes("enabled: currentSettings.enabled") && provider.includes("mode: currentSettings.mode") && provider.includes("currentPhase: phaseRef.current"), "visibility log includes hidden/visibilityState/enabled/mode/currentPhase");
  });

  console.log(`\nPhase 9B global visibility lifecycle results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

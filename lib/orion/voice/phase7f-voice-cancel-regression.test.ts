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
  const overlay = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");
  const voiceSession = read("lib/orion/voice/voice-session.ts");
  const globalProvider = read("components/orion/voice/GlobalOrionVoiceProvider.tsx");

  test("1. enabling hands-free starts wake listening once", () => {
    assert(overlay.includes("if (enabled) {") && overlay.includes("startWakeListeningSession();"), "hands-free enabled branch calls startWakeListeningSession");
    assert(overlay.includes("} else {") && overlay.includes("stopWakeListeningSession();"), "hands-free disabled branch calls stopWakeListeningSession");
    assert(countMatches(overlay, /startWakeListeningSession\(\);/g) >= 1, "startWakeListeningSession is wired into activation flow");
  });

  test("2. unrelated rerenders do not cancel voice from full-object dependencies", () => {
    assert(overlay.includes("const cancelVoice = () => {") && overlay.includes("Command center close should not stop global voice session."), "overlay close cancellation is a global-voice-safe no-op");
    assert(!overlay.includes("[open, voice]"), "close cleanup effect no longer depends on full voice object");
    assert(!overlay.includes("[currentPath, open, voice]"), "route-change effect no longer depends on full voice object");
    assert(!overlay.includes("[voice]"), "visibility effect no longer depends on full voice object");
  });

  test("3. overlay close still cancels once", () => {
    assert(overlay.includes("if (!open) {") && overlay.includes("cancelVoice();"), "overlay close path still cancels active capture");
    assert(countMatches(overlay, /if \(!open\) \{[\s\S]*?cancelVoice\(\);/g) >= 1, "there is an explicit closed-state cancellation branch");
  });

  test("4. disabling hands-free still cancels once", () => {
    assert(overlay.includes("function stopWakeListeningSession()"), "stopWakeListeningSession helper exists");
    assert(overlay.includes("voice.cancel();"), "stopWakeListeningSession uses voice.cancel");
    assert(countMatches(overlay, /function stopWakeListeningSession\([\s\S]*?voice\.cancel\(\);/g) === 1, "stopWakeListeningSession has a single cancel call");
  });

  test("5. document hidden still cancels voice", () => {
    assert(globalProvider.includes("document.hidden || document.visibilityState === \"hidden\""), "global provider checks true hidden document state");
    assert(globalProvider.includes("voiceStopRef.current();") && globalProvider.includes("Voice paused while tab is hidden."), "hidden visibility path stops voice capture from provider");
  });

  test("6. normal activation is not aborted by route effect before onstart", () => {
    assert(overlay.includes("if (!previousOpenPathRef.current) {") && overlay.includes("previousOpenPathRef.current = currentPath;"), "route effect initializes path without canceling on open");
    assert(overlay.includes("if (previousOpenPathRef.current !== currentPath) {") && overlay.includes("cancelVoice();"), "route effect cancels only on actual path change");
    assert(!overlay.includes("if (!open) {\n      return;\n    }\n\n    voice.cancel();"), "unconditional cancel-on-open route effect is removed");
    assert(voiceSession.includes("recognition.start() returned") && voiceSession.includes("recognition.onstart"), "lifecycle instrumentation remains for start and onstart verification");
  });

  console.log(`\nPhase 7F voice cancellation regression results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

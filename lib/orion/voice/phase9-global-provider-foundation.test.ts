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

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function main() {
  const appShell = read("app/(app)/app-shell.tsx");
  const globalProvider = read("components/orion/voice/GlobalOrionVoiceProvider.tsx");
  const overlay = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");
  const persistentPanel = read("components/orion/persistent/PersistentOrionPanel.tsx");

  test("1. provider mounts once in authenticated app shell", () => {
    assert(appShell.includes("GlobalOrionVoiceProvider"), "app shell imports global provider");
    assert(appShell.includes("<GlobalOrionVoiceProvider>"), "app shell wraps frame in global provider");
  });

  test("2. command center and persistent panel subscribe instead of owning sessions", () => {
    assert(overlay.includes("useGlobalOrionVoice"), "overlay subscribes to global provider");
    assert(!overlay.includes("useOrionVoiceSession({"), "overlay no longer creates a local voice session instance");
    assert(persistentPanel.includes("useGlobalOrionVoice"), "persistent panel subscribes to global provider");
    assert(!persistentPanel.includes("useOrionVoiceSession({"), "persistent panel no longer creates a local voice session instance");
  });

  test("3. provider defines canonical global phases", () => {
    const required = [
      "disabled",
      "unsupported",
      "permission_required",
      "permission_denied",
      "reactivation_required",
      "starting",
      "waiting_for_wake",
      "wake_detected",
      "listening",
      "finalizing",
      "understanding",
      "clarification_required",
      "confirmation_required",
      "executing",
      "speaking",
      "success",
      "no_match",
      "error",
      "stopping",
    ];

    for (const phase of required) {
      assert(globalProvider.includes(`| "${phase}"`), `global phase includes ${phase}`);
    }
  });

  test("4. provider routes voice through intent and execute API", () => {
    assert(globalProvider.includes('mode: "intent"'), "provider sends intent-mode requests");
    assert(globalProvider.includes('fetch("/api/orion/command-center"'), "provider executes commands through command-center API");
    assert(globalProvider.includes("idempotencyKey"), "provider supplies idempotency key");
    assert(globalProvider.includes("correlationId"), "provider supplies correlation id");
  });

  test("5. provider includes voice command mode and control phrases", () => {
    assert(globalProvider.includes("activate voice command"), "provider recognizes activation control phrase");
    assert(globalProvider.includes("end voice command"), "provider recognizes end control phrase");
    assert(globalProvider.includes("Voice Command Mode activated"), "provider announces command mode activation");
    assert(globalProvider.includes("Voice Command Mode ended"), "provider announces command mode end");
  });

  console.log(`\nPhase 9 global voice provider foundation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

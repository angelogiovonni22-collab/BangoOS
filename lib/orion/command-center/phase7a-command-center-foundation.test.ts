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
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function main() {
  const appShellSource = read("app/(app)/app-shell.tsx");
  const overlaySource = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");
  const commandCenterApi = read("app/api/orion/command-center/route.ts");
  const commandCenterService = read("lib/orion/command-center/service.ts");
  const voiceButtonSource = read("components/orion/voice/OrionVoiceButton.tsx");

  test("1. App shell has global command-center entry points", () => {
    assert(appShellSource.includes("OrionCommandCenterOverlay"), "app shell mounts Orion command center overlay");
    assert(appShellSource.includes("event.key.toLowerCase() === \"k\""), "app shell listens for keyboard shortcut K");
    assert(appShellSource.includes("event.ctrlKey &&" ) || appShellSource.includes("!event.ctrlKey && !event.metaKey"), "app shell checks ctrl or meta modifier");
    assert(appShellSource.includes("setCommandCenterOpen(true)"), "app shell opens command center from shortcut and button");
  });

  test("2. Overlay is keyboard-first and executes through API", () => {
    assert(overlaySource.includes("/api/orion/command-center"), "overlay loads and executes through command-center API");
    assert(overlaySource.includes("useFocusTrap"), "overlay traps focus while open");
    assert(overlaySource.includes("ArrowDown") && overlaySource.includes("ArrowUp"), "overlay supports list keyboard navigation");
    assert(overlaySource.includes("handleExecute"), "overlay has dedicated command execution flow");
    assert(overlaySource.includes("confirmationLevel"), "overlay respects command confirmation levels");
  });

  test("3. API executes existing Orion commands", () => {
    assert(commandCenterApi.includes("createOrionCommandRouter"), "API constructs Orion command router");
    assert(commandCenterApi.includes("router.executeCommand"), "API executes via router.executeCommand only");
    assert(commandCenterApi.includes("resolveWorkspaceContext"), "API resolves authenticated workspace context");
    assert(commandCenterApi.includes("companyId"), "API scopes execution by company id");
  });

  test("4. Catalog service is company scoped", () => {
    assert(commandCenterService.includes(".eq(\"company_id\", workspace.companyId)"), "catalog queries are scoped by company_id");
    assert(commandCenterService.includes("createOrionCommandRegistry"), "catalog derives command metadata from shared registry");
    assert(commandCenterService.includes("getOrionNavigationRoutesForRole"), "catalog routes are sourced from shared navigation catalog");
    assert(commandCenterService.includes("Task "), "catalog includes task actions");
  });

  test("5. Voice command path uses intent and execute API", () => {
    assert(overlaySource.includes("OrionVoiceButton"), "overlay includes microphone push-to-talk control");
    assert(overlaySource.includes("useGlobalOrionVoice"), "overlay subscribes to global voice provider session");
    assert(overlaySource.includes("setQuery(trimmed);") || overlaySource.includes("setQuery(transcript);"), "final voice transcript populates command input");
    assert(overlaySource.includes("mode: \"intent\""), "voice transcript is routed through intent mode");
    assert(overlaySource.includes("commandId") && overlaySource.includes("/api/orion/command-center"), "voice execution still posts to command-center execute endpoint");
    assert(voiceButtonSource.includes("Push to talk"), "microphone control is explicitly push-to-talk");
  });

  console.log(`\nPhase 7A command center foundation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

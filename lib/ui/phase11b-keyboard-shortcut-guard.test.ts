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

function count(source: string, value: string) {
  return source.split(value).length - 1;
}

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function main() {
  const appShellSource = read("app/(app)/app-shell.tsx");
  const keyboardSource = read("lib/ui/keyboard.ts");
  const overlaySource = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");

  test("1. global shortcuts remain available outside editable targets", () => {
    assert(appShellSource.includes("event.key.toLowerCase() === \"k\""), "app shell keeps Ctrl/Cmd+K shortcut key");
    assert(appShellSource.includes("!event.ctrlKey && !event.metaKey"), "app shell keeps modifier requirement for palette shortcut");
    assert(appShellSource.includes("setCommandCenterOpen(true)"), "app shell still opens Orion Command Center from shortcut");
  });

  test("2. global shortcut handler bails before command evaluation", () => {
    const guardIndex = appShellSource.indexOf("shouldIgnoreGlobalShortcut(event)");
    const keyIndex = appShellSource.indexOf("event.key.toLowerCase() === \"k\"");
    assert(guardIndex >= 0, "app shell uses shared global keyboard guard");
    assert(keyIndex >= 0 && guardIndex < keyIndex, "editable/default/composition guard runs before shortcut key evaluation");
  });

  test("3. editable targets are covered by shared guard", () => {
    assert(keyboardSource.includes("export function isEditableKeyboardTarget"), "shared editable-target helper is exported");
    assert(keyboardSource.includes("HTMLInputElement") && keyboardSource.includes("HTMLTextAreaElement") && keyboardSource.includes("HTMLSelectElement"), "input, textarea, and select are treated as editable");
    assert(keyboardSource.includes("element.isContentEditable"), "contenteditable elements are treated as editable");
    assert(keyboardSource.includes("[contenteditable='true']"), "contenteditable ancestors are treated as editable");
    assert(keyboardSource.includes("[role='textbox']"), "role textbox ancestors are treated as editable");
    assert(keyboardSource.includes("[role='searchbox']"), "role searchbox ancestors are treated as editable");
    assert(keyboardSource.includes("[role='combobox']"), "role combobox ancestors are treated as editable");
  });

  test("4. composition and prevented events are ignored", () => {
    assert(keyboardSource.includes("event.defaultPrevented"), "defaultPrevented events are ignored");
    assert(keyboardSource.includes("event.isComposing") || keyboardSource.includes("isImeComposing"), "IME composition state is ignored");
    assert(keyboardSource.includes("keyCode === 229") || keyboardSource.includes("which === 229"), "IME keyCode fallback is ignored");
  });

  test("5. modifier-only key presses are ignored", () => {
    assert(keyboardSource.includes("MODIFIER_ONLY_KEYS"), "modifier-only key set is defined");
    assert(keyboardSource.includes("isModifierOnlyKey"), "modifier-only guard helper is applied");
    assert(keyboardSource.includes("event.key.toLowerCase()"), "modifier-only detection normalizes key casing");
  });

  test("6. Orion input retains submit/cancel keyboard behavior", () => {
    assert(overlaySource.includes("if (event.key === \"Enter\")"), "Orion input still handles Enter submit");
    assert(overlaySource.includes("if (event.key === \"Escape\")"), "Orion overlay still handles Escape close/cancel");
  });

  test("7. no duplicate app-shell global keydown listener", () => {
    assert(count(appShellSource, "window.addEventListener(\"keydown\", handleKeyDown)") === 1, "app shell registers global shortcut keydown listener exactly once");
  });

  console.log(`\nPhase 11B keyboard shortcut guard results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

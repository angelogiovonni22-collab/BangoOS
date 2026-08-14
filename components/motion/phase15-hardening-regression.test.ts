import { resolveReducedMotion } from "./motion-preferences";
import { canRestoreFocus, getWrappedFocusIndex } from "./focus-trap";
import { resolveSlidePanelClassNames } from "./slide-panel";
import { collectNewEntityIds, hasAnimatedEntries } from "../../lib/motion/replay-helpers";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  console.log(`\n${name}`);
  await fn();
}

async function main(): Promise<void> {
  await test("1. reduced-motion preference resolution", () => {
    assert(resolveReducedMotion("system", true), "system respects reduced OS preference");
    assert(!resolveReducedMotion("system", false), "system respects full-motion OS preference");
    assert(resolveReducedMotion("reduced", false), "reduced preference forces reduced motion");
    assert(!resolveReducedMotion("full", true), "full preference forces full motion");
  });

  await test("2. focus trapping index wraps correctly", () => {
    assert(getWrappedFocusIndex(0, -1, 3) === 2, "Shift+Tab from first wraps to last");
    assert(getWrappedFocusIndex(2, 1, 3) === 0, "Tab from last wraps to first");
    assert(getWrappedFocusIndex(1, 1, 3) === 2, "Tab moves to next element");
    assert(getWrappedFocusIndex(0, 1, 0) === -1, "Empty focus set returns sentinel");
    assert(!canRestoreFocus(null), "null element is not restorable");

    const restorable = { focus: () => undefined } as unknown as HTMLElement;
    assert(canRestoreFocus(restorable), "element with focus method is restorable");
  });

  await test("3. timeline replay suppression helper only marks new IDs", () => {
    const known = new Set(["a", "b"]);
    const result = collectNewEntityIds(known, ["a", "b", "c", "d"]);

    assert(Boolean(result.c), "new id c is marked for animation");
    assert(Boolean(result.d), "new id d is marked for animation");
    assert(!Boolean(result.a), "existing id a is not marked");
    assert(!Boolean(result.b), "existing id b is not marked");
    assert(hasAnimatedEntries(result), "result reports animated entries");
    assert(!hasAnimatedEntries({}), "empty result reports no animated entries");
  });

  await test("4. SiteCam transition helper behavior", () => {
    const previous = new Set(["photo-1", "photo-2"]);
    const incoming = ["photo-2", "photo-3", "photo-4"];
    const next = collectNewEntityIds(previous, incoming);

    assert(Object.keys(next).length === 2, "only two new photos are flagged");
    assert(Boolean(next["photo-3"]) && Boolean(next["photo-4"]), "new photo IDs are preserved");
  });

  await test("5. mobile sheet transition classes", () => {
    const fullMotionOpen = resolveSlidePanelClassNames({
      open: true,
      from: "bottom",
      reducedMotion: false,
      className: "sheet",
    });

    const reducedClosed = resolveSlidePanelClassNames({
      open: false,
      from: "bottom",
      reducedMotion: true,
      className: "sheet",
    });

    assert(fullMotionOpen.includes("bf-slide-panel"), "base slide panel class present");
    assert(fullMotionOpen.includes("bf-panel-bottom"), "bottom direction class present");
    assert(fullMotionOpen.includes("bf-panel-open"), "open state class present");
    assert(reducedClosed.includes("bf-panel-closed"), "closed state class present");
    assert(reducedClosed.includes("bf-no-motion"), "reduced-motion class present");
  });

  console.log(`\nPhase 1.5 hardening regression results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

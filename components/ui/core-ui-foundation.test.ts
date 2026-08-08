import fs from "node:fs";
import path from "node:path";
import { classifyDepthLayer, resolveDepthClassName } from "@/components/bangoflow";
import {
  getBodyScrollLockCount,
  isTopmostOverlay,
  lockDocumentBody,
  registerOverlay,
  resetOverlayRuntimeForTests,
  unlockDocumentBody,
  unregisterOverlay,
} from "./overlay-runtime";
import { resolvePortalContainer } from "./portal-host";
import { resolveSlidePanelClassNames } from "@/components/motion";

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

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const portalHost = read("components/ui/portal-host.tsx");
  const overlayBackdrop = read("components/ui/overlay-backdrop.tsx");
  const dialog = read("components/ui/dialog.tsx");
  const drawer = read("components/ui/drawer.tsx");
  const bottomSheet = read("components/ui/bottom-sheet.tsx");
  const dashboardCustomizer = read("components/dashboard/DashboardCustomizer.tsx");

  await test("1. portal host resolves document.body", () => {
    const previousDocument = globalThis.document;
    const mockBody = { marker: "body" } as unknown as HTMLElement;

    Object.assign(globalThis, {
      document: { body: mockBody },
    });

    assert(resolvePortalContainer() === mockBody, "portal host defaults to document.body");
    assert(portalHost.includes("useSyncExternalStore"), "portal host uses hydration-safe mounted snapshot gating");
    assert(portalHost.includes("getServerMountedSnapshot") && portalHost.includes("return false;"), "portal host server snapshot keeps SSR and first client render aligned");
    assert(portalHost.includes("if (!mounted) {") && portalHost.includes("return null;"), "portal host renders null until mounted to keep first client render aligned with SSR");
    assert(portalHost.includes("createPortal(children, target)"), "portal host renders through React portal");

    Object.assign(globalThis, {
      document: previousDocument,
    });
  });

  await test("2. layer hierarchy classifies shared depths", () => {
    assert(classifyDepthLayer("surface") === "application", "surface maps to application layer");
    assert(classifyDepthLayer("header") === "stickyNav", "header maps to sticky navigation layer");
    assert(classifyDepthLayer("overlay") === "popover", "legacy overlay maps to popover layer");
    assert(classifyDepthLayer("backdrop") === "backdrop", "backdrop maps to backdrop layer");
    assert(resolveDepthClassName("dialog").includes("var(--z-modal)"), "dialog depth resolves modal token");
    assert(resolveDepthClassName("criticalAlert").includes("var(--z-critical)"), "critical alert depth resolves critical token");
  });

  await test("3. backdrop covers the viewport", () => {
    assert(overlayBackdrop.includes("fixed inset-0"), "backdrop uses full-viewport fixed positioning");
    assert(overlayBackdrop.includes("layer=\"backdrop\""), "backdrop renders on the shared backdrop layer");
  });

  await test("4. overlay runtime supports nested body locks and stack ordering", () => {
    resetOverlayRuntimeForTests();

    const mockDocument = {
      body: {
        style: {
          overflow: "",
          removeProperty(property: string) {
            if (property === "overflow") {
              this.overflow = "";
            }
          },
        },
      },
    };

    lockDocumentBody(mockDocument);
    lockDocumentBody(mockDocument);
    assert(getBodyScrollLockCount() === 2, "body scroll lock reference counts nested overlays");
    assert(mockDocument.body.style.overflow === "hidden", "body scroll lock hides overflow");

    unlockDocumentBody(mockDocument);
    assert(getBodyScrollLockCount() === 1, "unlock decrements nested lock count without restoring early");
    assert(mockDocument.body.style.overflow === "hidden", "overflow remains hidden while nested lock is active");

    unlockDocumentBody(mockDocument);
    assert(getBodyScrollLockCount() === 0, "unlock clears final body lock");
    assert(mockDocument.body.style.overflow === "", "overflow is restored after final unlock");

    registerOverlay("dialog-a");
    registerOverlay("dialog-b");
    assert(!isTopmostOverlay("dialog-a"), "older overlay is not topmost when nested");
    assert(isTopmostOverlay("dialog-b"), "newer overlay becomes topmost");

    unregisterOverlay("dialog-b");
    assert(isTopmostOverlay("dialog-a"), "previous overlay becomes topmost after nested close");
  });

  await test("5. shared overlays still wire escape and focus behavior", () => {
    assert(dialog.includes("useFocusTrap"), "dialog uses shared focus trap");
    assert(dialog.includes("event.key === \"Escape\""), "dialog closes on Escape");
    assert(drawer.includes("trapFocus"), "drawer forwards focus trapping");
    assert(bottomSheet.includes("from=\"bottom\""), "bottom sheet uses bottom-origin slide panel");
  });

  await test("6. reduced motion and resting transforms stay aligned", () => {
    const classes = resolveSlidePanelClassNames({
      open: true,
      from: "bottom",
      reducedMotion: true,
      className: "sheet",
    });

    assert(classes.includes("bf-no-motion"), "slide panel keeps reduced-motion class support");
    assert(classes.includes("bf-panel-bottom"), "slide panel keeps bottom-sheet direction class");
  });

  await test("7. dashboard customizer uses a non-blocking popover interaction model", () => {
    assert(dashboardCustomizer.includes("PortalHost"), "dashboard customizer mounts through shared portal host");
    assert(dashboardCustomizer.includes("LayerManager layer=\"spotlight\""), "dashboard customizer renders above standard overlays");
    assert(!dashboardCustomizer.includes("<OverlayBackdrop") && !dashboardCustomizer.includes("import { OverlayBackdrop"), "dashboard customizer does not render a click-blocking viewport backdrop");
    assert(!dashboardCustomizer.includes("useBodyScrollLock"), "dashboard customizer does not lock body scroll for a popover panel");
    assert(dashboardCustomizer.includes("document.addEventListener(\"mousedown\", handlePointerDown)"), "dashboard customizer closes through click-outside handling");
    assert(dashboardCustomizer.includes("useFocusTrap"), "dashboard customizer retains focus trap behavior");
  });

  console.log(`\nCore UI foundation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
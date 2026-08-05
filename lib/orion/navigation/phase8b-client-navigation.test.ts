import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyOrionCommandNavigationResult } from "./client-navigation";

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

function main() {
  test("1. back navigation requests history when available", () => {
    let wentBack = 0;
    let pushed: string | null = null;

    const result = applyOrionCommandNavigationResult({
      result: {
        href: "/dashboard",
        details: {
          navigationAction: "back",
          fallbackHref: "/dashboard",
        },
      },
      canGoBack: true,
      goBack: () => {
        wentBack += 1;
      },
      push: (href) => {
        pushed = href;
      },
    });

    assert(wentBack === 1, "history back is requested exactly once");
    assert(pushed === null, "fallback push is not used when history exists");
    assert(result.mode === "back", "result mode is back");
    assert(!result.usedFallback, "fallback is not used when history exists");
  });

  test("2. back navigation falls back explicitly when history is unavailable", () => {
    let wentBack = 0;
    let pushed: string | null = null;

    const result = applyOrionCommandNavigationResult({
      result: {
        href: "/dashboard",
        details: {
          navigationAction: "back",
          fallbackHref: "/dashboard",
        },
      },
      canGoBack: false,
      goBack: () => {
        wentBack += 1;
      },
      push: (href) => {
        pushed = href;
      },
    });

    assert(wentBack === 0, "history back is not requested when unavailable");
    assert(pushed === "/dashboard", "dashboard fallback is pushed explicitly");
    assert(result.mode === "push", "fallback mode is push");
    assert(result.usedFallback, "fallback usage is reported");
    assert(result.fallbackHref === "/dashboard", "fallback href is returned");
  });

  test("3. non-back navigation still uses href push", () => {
    let pushed: string | null = null;

    const result = applyOrionCommandNavigationResult({
      result: {
        href: "/projects",
      },
      canGoBack: true,
      goBack: () => undefined,
      push: (href) => {
        pushed = href;
      },
    });

    assert(pushed === "/projects", "href navigation still pushes target route");
    assert(result.mode === "push", "mode remains push for normal navigation");
    assert(!result.usedFallback, "normal push does not use fallback");
  });

  test("4. router.back is only used in client navigation layers", () => {
    const resolverSource = readFileSync(resolve(process.cwd(), "lib/orion/intent-engine/resolver.ts"), "utf8");
    const wakeSource = readFileSync(resolve(process.cwd(), "lib/orion/voice/wake-word-normalizer.ts"), "utf8");
    const providerSource = readFileSync(resolve(process.cwd(), "components/orion/voice/GlobalOrionVoiceProvider.tsx"), "utf8");

    assert(!resolverSource.includes("router.back("), "intent resolver does not call router.back directly");
    assert(!wakeSource.includes("router.back("), "wake-word code does not call router.back directly");
    assert(providerSource.includes("router.back()"), "client navigation layer can invoke router.back");
  });

  console.log(`\nPhase 8B client navigation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

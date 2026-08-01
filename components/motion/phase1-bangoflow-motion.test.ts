import {
  isMotionPreference,
  resolveReducedMotion,
} from "./motion-preferences";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed += 1;
  }
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  console.log(`\n${name}`);
  await fn();
}

async function main(): Promise<void> {
  await test("1. preference parser recognizes valid preferences", () => {
    assert(isMotionPreference("system"), "system preference accepted");
    assert(isMotionPreference("reduced"), "reduced preference accepted");
    assert(isMotionPreference("full"), "full preference accepted");
  });

  await test("2. preference parser rejects invalid values", () => {
    assert(!isMotionPreference(""), "empty string rejected");
    assert(!isMotionPreference("none"), "unknown preference rejected");
    assert(!isMotionPreference("partial"), "partial preference rejected");
  });

  await test("3. reduced preference always resolves to reduced motion", () => {
    assert(resolveReducedMotion("reduced", true), "reduced + system reduced resolves true");
    assert(resolveReducedMotion("reduced", false), "reduced + system full resolves true");
  });

  await test("4. full preference always resolves to full motion", () => {
    assert(!resolveReducedMotion("full", true), "full + system reduced resolves false");
    assert(!resolveReducedMotion("full", false), "full + system full resolves false");
  });

  await test("5. system preference mirrors OS preference", () => {
    assert(resolveReducedMotion("system", true), "system follows OS reduced");
    assert(!resolveReducedMotion("system", false), "system follows OS full");
  });

  console.log(`\nBangoFlow Phase 1 motion test results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

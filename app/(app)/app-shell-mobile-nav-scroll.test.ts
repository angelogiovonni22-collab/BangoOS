import { readFileSync } from "node:fs";
import { join } from "node:path";

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

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

async function main() {
  await test("1. app shell mobile nav uses bounded dedicated scroll region", () => {
    const source = readFileSync(join(process.cwd(), "app", "(app)", "app-shell.tsx"), "utf8");

    assert(source.includes("<div className=\"mt-7 flex min-h-0 flex-1 flex-col overflow-hidden\">"), "sidebar content column creates bounded flex chain for scrolling");
    assert(source.includes("<nav className=\"min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain touch-pan-y pr-1 [-webkit-overflow-scrolling:touch]\">"), "nav is the dedicated touch-safe overflow container with iOS momentum scrolling");
    assert(source.includes("<div className=\"mt-auto shrink-0 rounded-[var(--radius-xl)] border border-white/10 bg-white/5 p-4 backdrop-blur\">"), "footer/account card remains outside nav scroll area");
    assert(!source.includes("<nav className=\"mt-7 space-y-3\">"), "legacy non-scroll nav container is removed");
  });

  await test("2. shell visual and theme classes remain unchanged", () => {
    const source = readFileSync(join(process.cwd(), "app", "(app)", "app-shell.tsx"), "utf8");

    assert(source.includes("<div className=\"min-h-screen bg-[var(--color-surface-app)] text-[var(--color-text-primary)] enterprise-shell\">"), "enterprise shell background and text color classes remain unchanged");
    assert(source.includes("border-r border-[#1e2b45] bg-[var(--color-sidebar)] px-5 py-6 text-white shadow-[0_24px_50px_-24px_rgba(15,23,42,0.85)]"), "sidebar visual color, spacing, and shadow classes remain unchanged");
  });

  console.log(`\nApp shell mobile nav scroll results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

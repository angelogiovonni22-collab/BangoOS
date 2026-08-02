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
  await test("1. app shell mobile nav uses dedicated scroll region", () => {
    const source = readFileSync(join(process.cwd(), "app", "(app)", "app-shell.tsx"), "utf8");

    assert(source.includes("<div className=\"mt-7 flex min-h-0 flex-1 flex-col\">"), "sidebar content column reserves dedicated scroll space");
    assert(source.includes("<nav className=\"min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]\">"), "nav is the dedicated overflow container with iOS momentum scrolling");
    assert(source.includes("<div className=\"mt-4 shrink-0 rounded-[var(--radius-xl)] border border-white/10 bg-white/5 p-4 backdrop-blur\">"), "footer/account card remains outside scroll area and pinned to bottom section");
    assert(!source.includes("<nav className=\"mt-7 space-y-3\">"), "legacy non-scroll nav container is removed");
  });

  console.log(`\nApp shell mobile nav scroll results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function main() {
  const page = readFileSync(join(process.cwd(), "app", "(app)", "daily-reports", "page.tsx"), "utf8");
  const loading = readFileSync(join(process.cwd(), "app", "(app)", "daily-reports", "loading.tsx"), "utf8");

  test("1. loading state is plain text only", () => {
    check(page.includes("Loading daily reports..."), "page shows a plain text loading state");
    check(loading.includes("Loading daily reports..."), "route loading file uses plain text");
    check(!page.includes("animate-pulse"), "page does not include pulse animation");
    check(!page.includes("SkeletonLoader"), "page does not use skeleton loaders");
  });

  test("2. page avoids unstable remount keys", () => {
    check(!page.includes("key={Date.now()"), "page does not key content by Date.now");
    check(!page.includes("Math.random()"), "page does not key content by Math.random");
  });

  test("3. page has stable loaded, empty, and error branches", () => {
    check(page.includes("Daily Reports could not be loaded."), "page has an explicit error state");
    check(page.includes("No daily reports found."), "page has an explicit empty state");
    check(page.includes("<ReportsView"), "page has an explicit loaded-content branch");
  });

  test("4. page uses existing routes", () => {
    check(page.includes('href="/daily-reports/new"'), "create report opens the existing new route");
    check(page.includes('href={`/daily-reports/${report.id}`}'), "view opens the existing detail route");
  });

  test("5. page does not preserve the old skeleton implementation", () => {
    check(!page.includes("ReportLoadingState"), "replacement page does not render the old skeleton component");
  });

  console.log(`\nDaily reports page render contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

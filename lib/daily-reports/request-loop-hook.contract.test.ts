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
  const listHook = readFileSync(join(process.cwd(), "lib", "daily-reports", "use-daily-reports.ts"), "utf8");
  const detailHook = readFileSync(join(process.cwd(), "lib", "daily-reports", "use-daily-report.ts"), "utf8");

  test("1. list hook does not allocate service in default parameter", () => {
    check(!listHook.includes("service = createDailyReportsService()"), "list hook signature does not instantiate service per render");
    check(listHook.includes("useRef<DailyReportsService>(service ?? createDailyReportsService())"), "list hook keeps service instance in a stable ref");
  });

  test("2. pagination updates are identity-safe", () => {
    check(listHook.includes("if (current.page === page && current.pageSize === pageSize)"), "pagination merge checks unchanged values");
    check(listHook.includes("return current;"), "pagination merge reuses current state when unchanged");
  });

  test("3. stale list responses are ignored after rerender/unmount", () => {
    check(listHook.includes("const requestId = activeRequestRef.current + 1"), "list hook tracks request ids");
    check(listHook.includes("requestId !== activeRequestRef.current"), "list hook ignores stale request responses");
    check(listHook.includes("unmountedRef.current"), "list hook ignores responses after unmount");
  });

  test("3b. list hook separates initial loading from background refresh", () => {
    check(listHook.includes("const hasSettledOnceRef = useRef(false);"), "list hook tracks whether first load has settled");
    check(listHook.includes("const [hasSettledOnce, setHasSettledOnce] = useState(false);"), "list hook exposes settled state to the page");
    check(listHook.includes("const [isRefreshing, setIsRefreshing] = useState(false);"), "list hook exposes a background refresh state");
    check(listHook.includes("if (shouldShowInitialLoading) {"), "list hook gates initial loading behavior");
    check(listHook.includes("setIsRefreshing(true);"), "list hook uses refreshing state after first settle");
    check(listHook.includes("setHasSettledOnce(true);"), "list hook marks the first successful load as settled");
    check(/if \(!hasSettledOnceRef\.current\) \{\s*setErrorMessage\("dailyReports\.error\.loadDashboard"\);\s*\}/m.test(listHook), "list hook keeps settled content mounted on background refresh failure");
  });

  test("4. detail hook does not allocate service in default parameter", () => {
    check(!detailHook.includes("service = createDailyReportsService()"), "detail hook signature does not instantiate service per render");
    check(detailHook.includes("useRef<DailyReportsService>(service ?? createDailyReportsService())"), "detail hook keeps service instance in a stable ref");
  });

  test("5. stale detail responses are ignored after rerender/unmount", () => {
    check(detailHook.includes("const requestId = activeRequestRef.current + 1"), "detail hook tracks request ids");
    check(detailHook.includes("requestId !== activeRequestRef.current"), "detail hook ignores stale request responses");
    check(detailHook.includes("unmountedRef.current"), "detail hook ignores responses after unmount");
  });

  test("6. hook retry behavior is bounded", () => {
    check(!listHook.includes("setInterval("), "list hook does not poll with setInterval");
    check(!detailHook.includes("setInterval("), "detail hook does not poll with setInterval");
    check(!listHook.includes("catch {\n      void refresh("), "list hook does not immediately self-retry on errors");
  });

  console.log(`\nDaily reports hook contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();

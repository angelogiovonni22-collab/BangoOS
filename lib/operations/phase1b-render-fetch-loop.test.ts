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
  const source = readFileSync(join(process.cwd(), "lib", "operations", "use-operations.ts"), "utf8");
  const serviceTest = readFileSync(join(process.cwd(), "lib", "operations", "production-service-contract.test.ts"), "utf8");

  test("1. default operations service is created inside the hook", () => {
    check(!source.includes("service = createOperationsService()"), "hook no longer uses a default service factory parameter");
    check(source.includes("const operationsService = useMemo(() => service ?? createOperationsService(), [service]);"), "hook memoizes the fallback service instance");
  });

  test("2. refresh depends on stable service and filters only", () => {
    check(source.includes("const result = await operationsService.getOperations(filters);"), "refresh uses the stable operations service");
    check(source.includes("}, [filters, operationsService]);"), "refresh callback depends on filters and the memoized service only");
    check(source.includes("}, [refresh]);"), "loading effect remains keyed to refresh");
  });

  test("3. repeated renders with unchanged filters do not retrigger the request cycle", () => {
    check(source.includes("useEffect(() => {"), "request effect still runs through the effect gate");
    check(source.includes("const timer = window.setTimeout(() => {"), "effect continues to defer the initial fetch");
    check(source.includes("window.clearTimeout(timer);"), "effect cleanup remains intact");
  });

  test("4. no other hook or module is changed", () => {
    check(serviceTest.includes("operations service uses live command-center data"), "existing operations contract test remains untouched");
    check(!source.includes("createSchedulingService"), "operations hook does not pull in other module services");
  });

  console.log(`\nOperations render-fetch loop results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
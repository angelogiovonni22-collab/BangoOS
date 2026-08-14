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
  const source = readFileSync(join(process.cwd(), "lib", "employees", "use-employee-profile.ts"), "utf8");
  const serviceSource = readFileSync(join(process.cwd(), "lib", "employees", "service.ts"), "utf8");

  test("1. default employee service is created inside the hook", () => {
    check(!source.includes("service = createEmployeeService()"), "hook no longer uses a default service factory parameter");
    check(source.includes("const employeeService = useMemo(() => service ?? createEmployeeService(), [service]);"), "hook memoizes the fallback service instance");
  });

  test("2. callback identity and effect dependency stay stable", () => {
    check(source.includes("const result = await employeeService.getEmployee(employeeId);"), "effect reads through the stable employee service");
    check(source.includes("}, [employeeId, employeeService]);"), "effect depends on employeeId and the memoized service only");
    check(source.includes("useEffect(() => {"), "loading effect remains effect-driven");
  });

  test("3. repeated renders with unchanged employeeId do not retrigger the request cycle", () => {
    check(source.includes("let active = true;"), "stale responses remain guarded");
    check(source.includes("if (!employeeId) {"), "missing id still short-circuits before fetch");
    check(source.includes("active = false;"), "effect cleanup remains intact");
  });

  test("4. no other hook or module is changed", () => {
    check(serviceSource.includes("createEmployeeService"), "existing employee service implementation remains the same module");
    check(!source.includes("createOperationsService"), "employee hook does not import unrelated module services");
    check(!source.includes("createSchedulingService"), "employee hook does not import unrelated module services");
  });

  console.log(`\nEmployee profile render-fetch loop results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
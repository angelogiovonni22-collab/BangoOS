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
  const serviceSource = readFileSync(join(process.cwd(), "lib", "operations", "service.ts"), "utf8");
  const operationsPageSource = readFileSync(join(process.cwd(), "app", "(app)", "operations", "page.tsx"), "utf8");
  const dashboardPageSource = readFileSync(join(process.cwd(), "app", "(app)", "dashboard", "page.tsx"), "utf8");

  test("1. production operations service has no mock dependency", () => {
    check(!serviceSource.includes("./mock-data"), "operations service no longer imports mock-data");
    check(!serviceSource.includes("getOperationsPayload"), "operations service no longer delegates to getOperationsPayload");
    check(serviceSource.includes("getOperationsCommandCenter"), "operations service uses live command-center data");
    check(serviceSource.includes("createCrewService"), "operations service uses live crew service data");
    check(serviceSource.includes("createEmployeeService"), "operations service uses live employee service data");
  });

  test("2. production operations payload avoids sample fixtures", () => {
    check(!serviceSource.includes("Northpoint Medical Center"), "service does not hard-code sample project names");
    check(!serviceSource.includes("Project Oak"), "service does not hard-code sample project names");
    check(!serviceSource.includes("Dock Expansion"), "service does not hard-code sample project names");
    check(!serviceSource.includes("Harper Residence"), "service does not hard-code sample project names");
  });

  test("3. production consumers remain on live paths", () => {
    check(operationsPageSource.includes("useOperationsCommandCenter"), "operations page uses live command-center hook");
    check(!operationsPageSource.includes("useOperations("), "operations page does not use legacy mock hook");
    check(!operationsPageSource.includes("mock-data"), "operations page does not import mock data");
    check(!dashboardPageSource.includes("mock-data"), "dashboard page does not import mock data");
  });

  console.log(`\nOperations production service contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
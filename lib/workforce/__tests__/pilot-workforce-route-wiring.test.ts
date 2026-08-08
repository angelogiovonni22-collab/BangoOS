import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type Test = {
  name: string;
  run: () => void;
};

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const tests: Test[] = [
  {
    name: "1. employee new/edit routes use canonical employee form",
    run: () => {
      const newPage = read("app/(app)/employees/new/page.tsx");
      const editPage = read("app/(app)/employees/[id]/edit/page.tsx");
      assert.ok(newPage.includes("<EmployeeForm"));
      assert.ok(newPage.includes("createEmployeeService"));
      assert.ok(editPage.includes("<EmployeeForm"));
      assert.ok(editPage.includes("updateEmployee"));
      assert.ok(!newPage.includes("CrewOS Phase 1 is read-only"));
      assert.ok(!editPage.includes("CrewOS Phase 1 is read-only"));
    },
  },
  {
    name: "2. crew new/edit routes use canonical crew form",
    run: () => {
      const newPage = read("app/(app)/crews/new/page.tsx");
      const editPage = read("app/(app)/crews/[id]/edit/page.tsx");
      assert.ok(newPage.includes("<CrewForm"));
      assert.ok(newPage.includes("createCrewService"));
      assert.ok(editPage.includes("<CrewForm"));
      assert.ok(editPage.includes("updateCrew"));
      assert.ok(!newPage.includes("CrewOS Phase 1 is read-only"));
      assert.ok(!editPage.includes("CrewOS Phase 1 is read-only"));
    },
  },
  {
    name: "3. employee and crew pages expose create/edit actions",
    run: () => {
      const employeesPage = read("app/(app)/employees/page.tsx");
      const employeeTable = read("components/employees/employee-table.tsx");
      const employeeProfile = read("app/(app)/employees/[id]/page.tsx");
      const crewsPage = read("app/(app)/crews/page.tsx");
      const crewTable = read("components/crews/crew-table.tsx");
      const crewProfile = read("app/(app)/crews/[id]/page.tsx");

      assert.ok(employeesPage.includes("/employees/new"));
      assert.ok(employeeTable.includes("/employees/${employee.id}/edit"));
      assert.ok(employeeProfile.includes("/employees/${employeeId}/edit"));

      assert.ok(crewsPage.includes("/crews/new"));
      assert.ok(crewTable.includes("/crews/${crew.id}/edit"));
      assert.ok(crewProfile.includes("/crews/${crewId}/edit"));
    },
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`+ ${test.name}`);
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`x ${test.name}`);
    console.error(error);
  }
}

console.log(`\nPilot workforce route wiring tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}

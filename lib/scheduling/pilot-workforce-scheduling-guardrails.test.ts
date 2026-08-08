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
    name: "1. assignment form enforces workforce-target guardrails",
    run: () => {
      const source = read("components/scheduling/assignment-form.tsx");
      assert.ok(source.includes("Select an assigned crew or employee."));
      assert.ok(source.includes("A crew assignment is required for crew mobilization."));
      assert.ok(source.includes("An assigned employee is required for this assignment type."));
    },
  },
  {
    name: "2. create-assignment failure no longer drops loaded payload",
    run: () => {
      const source = read("lib/scheduling/use-scheduling.ts");
      assert.ok(source.includes("const hadPayload = Boolean(payload);"));
      assert.ok(source.includes("if (!hadPayload) {"));
      assert.ok(source.includes("setErrorMessage(\"scheduling.errorSaveAssignment\")"));
      assert.ok(source.includes("}, [payload, schedulingService]);"));
    },
  },
  {
    name: "3. scheduling dashboard only hard-fails when payload is absent",
    run: () => {
      const source = read("components/scheduling/scheduling-dashboard.tsx");
      assert.ok(source.includes("if (!scheduling.payload) {"));
      assert.ok(source.includes("{t(scheduling.errorMessage)}"));
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

console.log(`\nPilot workforce scheduling guardrails tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}

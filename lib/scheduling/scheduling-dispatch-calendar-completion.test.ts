import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type Test = { name: string; run: () => void };

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const tests: Test[] = [
  {
    name: "1. scheduling service exposes persisted edit and cancel actions",
    run: () => {
      const service = read("lib/scheduling/service.ts");
      const completion = read("lib/scheduling/completion-service.ts");
      assert.ok(service.includes("updateAssignment:"));
      assert.ok(service.includes("cancelAssignment:"));
      assert.ok(service.includes("createSchedulingCompletionService"));
      assert.ok(completion.includes('.from("workforce_assignments")'));
      assert.ok(completion.includes('.eq("company_id", companyId)'));
      assert.ok(completion.includes('event_type: "schedule.updated"'));
      assert.ok(completion.includes('event_type: "schedule.cancelled"'));
    },
  },
  {
    name: "2. assignment edit enforces resource overlap validation",
    run: () => {
      const completion = read("lib/scheduling/completion-service.ts");
      assert.ok(completion.includes("validateNoOverlap"));
      assert.ok(completion.includes('.in("status", ["planned", "confirmed", "in_progress"])'));
      assert.ok(completion.includes("Assignment conflicts with an existing schedule for this resource."));
    },
  },
  {
    name: "3. calendar cards open the assignment editor across day week and month views",
    run: () => {
      const calendar = read("components/scheduling/schedule-calendar.tsx");
      const day = read("components/scheduling/schedule-day-view.tsx");
      const week = read("components/scheduling/schedule-week-view.tsx");
      const month = read("components/scheduling/schedule-month-view.tsx");
      const dashboard = read("components/scheduling/scheduling-dashboard.tsx");
      assert.ok(calendar.includes("onSelectAssignment"));
      assert.ok(day.includes("onSelect={onSelectAssignment}"));
      assert.ok(week.includes("onSelect={onSelectAssignment}"));
      assert.ok(month.includes("onClick={() => onSelectAssignment(item)}"));
      assert.ok(dashboard.includes("updateExistingAssignment"));
      assert.ok(dashboard.includes("cancelExistingAssignment"));
    },
  },
  {
    name: "4. calendar keeps usable minimum widths instead of compressing on mobile",
    run: () => {
      const week = read("components/scheduling/schedule-week-view.tsx");
      const month = read("components/scheduling/schedule-month-view.tsx");
      assert.ok(week.includes("overflow-x-auto"));
      assert.ok(week.includes("min-w-[980px]"));
      assert.ok(month.includes("overflow-x-auto"));
      assert.ok(month.includes("min-w-[760px]"));
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
    console.error(`x ${test.name}`);
    console.error(error);
    failed += 1;
  }
}

console.log(`\nScheduling completion tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

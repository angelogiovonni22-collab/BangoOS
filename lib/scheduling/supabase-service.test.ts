import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildLaborForecast } from "./forecast-service";

type Test = {
  name: string;
  run: () => void;
};

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const tests: Test[] = [
  {
    name: "1. service no longer imports mock scheduling module",
    run: () => {
      const serviceSource = read("lib/scheduling/service.ts");
      assert.ok(!serviceSource.includes("./mock-data"));
      assert.ok(serviceSource.includes("./supabase-service"));
    },
  },
  {
    name: "2. unsupported scheduling methods throw explicit production errors",
    run: () => {
      const source = read("lib/scheduling/supabase-service.ts");
      assert.ok(source.includes("Persistent dispatch state is not implemented in the current production schema."));
      assert.ok(source.includes("Persistent open shift state is not implemented in the current production schema."));
      assert.ok(source.includes("Persistent conflict resolution state is not implemented in the current production schema."));
      assert.ok(source.includes("Persistent insight status is not implemented in the current production schema."));
    },
  },
  {
    name: "3. workforce assignment mapping uses real columns only",
    run: () => {
      const source = read("lib/scheduling/supabase-service.ts");
      assert.ok(source.includes("const assignments = rows.assignments.map("));
      assert.ok(source.includes("row.id"));
      assert.ok(source.includes("row.assignment_type"));
      assert.ok(source.includes("row.title"));
      assert.ok(source.includes("row.description"));
      assert.ok(source.includes("row.project_id"));
      assert.ok(source.includes("row.phase_id"));
      assert.ok(source.includes("row.task_id"));
      assert.ok(source.includes("row.crew_id"));
      assert.ok(source.includes("row.employee_id"));
      assert.ok(source.includes("row.starts_at"));
      assert.ok(source.includes("row.ends_at"));
      assert.ok(source.includes("row.planned_hours"));
      assert.ok(source.includes("row.status"));
      assert.ok(source.includes("row.notes"));
      assert.ok(source.includes("row.source_type"));
      assert.ok(source.includes("row.source_id"));
    },
  },
  {
    name: "4. production scheduling service contains no fixture project names",
    run: () => {
      const source = read("lib/scheduling/supabase-service.ts");
      const blocked = [
        "Project Oak",
        "Northpoint Medical Center",
        "Dock Expansion",
        "Barton Creek",
        "Central Texas",
      ];

      for (const term of blocked) {
        assert.ok(!source.includes(term), `unexpected fixture term found: ${term}`);
      }
    },
  },
  {
    name: "5. forecast empty input returns zero metrics and no risks",
    run: () => {
      const forecast = buildLaborForecast([], "7d");
      assert.equal(forecast.summaryCards.find((card) => card.id === "required")?.value, "0");
      assert.equal(forecast.summaryCards.find((card) => card.id === "scheduled")?.value, "0");
      assert.equal(forecast.summaryCards.find((card) => card.id === "shortage")?.value, "0");
      assert.equal(forecast.summaryCards.find((card) => card.id === "openShifts")?.value, "0");
      assert.equal(forecast.summaryCards.find((card) => card.id === "overtime")?.value, "0");
      assert.equal(forecast.demandByTrade.length, 0);
      assert.equal(forecast.demandByProject.length, 0);
      assert.equal(forecast.demandByCrew.length, 0);
      assert.equal(forecast.demandByLocation.length, 0);
      assert.equal(forecast.demandByShift.length, 0);
      assert.equal(forecast.risks.length, 0);
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

console.log(`\nScheduling supabase service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}

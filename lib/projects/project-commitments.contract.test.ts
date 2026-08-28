import { strict as assert } from "node:assert";
import { calculateLaborCost, compensationMethodLabel, summarizeProjectCommitments } from "./project-commitments";

assert.equal(calculateLaborCost({ method: "hourly", rate: 35, projectedHours: 40 }), 1400);
assert.equal(calculateLaborCost({ method: "payroll_rate", rate: 42.5, projectedHours: 8 }), 340);
assert.equal(calculateLaborCost({ method: "prevailing_wage", rate: 54.25, projectedHours: 10 }), 542.5);
assert.equal(calculateLaborCost({ method: "day_rate", rate: 500, actualDays: 3 }, true), 1500);
assert.equal(calculateLaborCost({ method: "piece_rate", rate: 12.5, projectedUnits: 16 }), 200);
assert.equal(calculateLaborCost({ method: "lump_sum", rate: 0, lumpSumAmount: 4200 }), 4200);
assert.equal(calculateLaborCost({ method: "lump_sum", rate: 0, lumpSumAmount: 4200, actualCostOverride: 2000 }, true), 2000);
assert.equal(compensationMethodLabel("prevailing_wage"), "Prevailing wage");

assert.deepEqual(summarizeProjectCommitments({
  budget: 100000,
  labor: [{ method: "hourly", rate: 50, projectedHours: 100, actualHours: 80 }],
  signedSubcontracts: [{ amount: 25000, status: "signed" }, { amount: 9000, status: "draft" }],
}), {
  laborProjected: 5000,
  laborActual: 4000,
  subcontractCommitted: 25000,
  totalCommitted: 30000,
  budgetRemainingAfterCommitments: 70000,
});

console.log("project commitments calculations: ok");

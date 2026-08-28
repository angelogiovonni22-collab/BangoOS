import { strict as assert } from "node:assert";
import { calculateLaborCost, summarizeProjectCommitments } from "./project-commitments";

assert.equal(calculateLaborCost({ method: "hourly", rate: 35, projectedHours: 40 }), 1400);
assert.equal(calculateLaborCost({ method: "salary", rate: 104000, projectedHours: 80 }), 4000);
assert.equal(calculateLaborCost({ method: "day_rate", rate: 500, actualDays: 3 }, true), 1500);
assert.equal(calculateLaborCost({ method: "piece_rate", rate: 12.5, projectedUnits: 16 }), 200);

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

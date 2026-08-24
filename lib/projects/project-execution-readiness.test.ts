import assert from "node:assert/strict";
import { calculateProjectExecutionReadiness } from "./project-execution-readiness";

assert.deepEqual(
  calculateProjectExecutionReadiness({ complianceScore: 100, overdueTasks: 0, blockedTasks: 0, activeTasks: 3, documentationPresent: true }),
  { score: 100, status: "Ready", nextAction: "execution" },
);

assert.deepEqual(
  calculateProjectExecutionReadiness({ complianceScore: 70, overdueTasks: 1, blockedTasks: 0, activeTasks: 2, documentationPresent: true }),
  { score: 83, status: "Watch", nextAction: "overdue" },
);

assert.deepEqual(
  calculateProjectExecutionReadiness({ complianceScore: 10, overdueTasks: 0, blockedTasks: 0, activeTasks: 0, documentationPresent: false }),
  { score: 45, status: "Action required", nextAction: "compliance" },
);

assert.equal(
  calculateProjectExecutionReadiness({ complianceScore: 90, overdueTasks: 0, blockedTasks: 2, activeTasks: 4, documentationPresent: true }).nextAction,
  "blocked",
);

console.log("project execution readiness tests passed");

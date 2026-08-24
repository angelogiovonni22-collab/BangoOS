import assert from "node:assert/strict";
import { calculateProjectComplianceReadiness } from "./project-compliance-readiness";

assert.deepEqual(
  calculateProjectComplianceReadiness({ permitsTotal: 2, openPermits: 0, inspectionsTotal: 3, pendingInspections: 0, documentsTotal: 4 }),
  { score: 100, status: "Ready", permitState: "Clear", inspectionState: "Clear", documentState: "Available" },
);

assert.deepEqual(
  calculateProjectComplianceReadiness({ permitsTotal: 2, openPermits: 1, inspectionsTotal: 3, pendingInspections: 1, documentsTotal: 2 }),
  { score: 70, status: "Watch", permitState: "Action required", inspectionState: "Pending", documentState: "Available" },
);

assert.deepEqual(
  calculateProjectComplianceReadiness({ permitsTotal: -2, openPermits: 99, inspectionsTotal: Number.NaN, pendingInspections: 4, documentsTotal: 0 }),
  { score: 0, status: "Setup required", permitState: "Not recorded", inspectionState: "Not recorded", documentState: "Missing" },
);

console.log("project compliance readiness tests passed");

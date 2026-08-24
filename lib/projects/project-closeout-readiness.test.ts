import assert from "node:assert/strict";
import { calculateProjectCloseoutReadiness } from "./project-closeout-readiness";

assert.deepEqual(
  calculateProjectCloseoutReadiness({
    closeoutStarted: true,
    finalPaymentRecorded: true,
    customerApprovalRecorded: true,
    requiredDocumentsCompleted: true,
    permitClosureCompleted: true,
    crewRemovalCompleted: true,
    equipmentReturnCompleted: true,
    openPunchItems: 0,
  }),
  { score: 100, status: "Ready", checklistCompleted: 6, checklistTotal: 6, punchState: "Clear" },
);

assert.deepEqual(
  calculateProjectCloseoutReadiness({
    closeoutStarted: true,
    finalPaymentRecorded: true,
    customerApprovalRecorded: true,
    requiredDocumentsCompleted: false,
    permitClosureCompleted: false,
    crewRemovalCompleted: false,
    equipmentReturnCompleted: false,
    openPunchItems: 2,
  }),
  { score: 28, status: "In progress", checklistCompleted: 2, checklistTotal: 6, punchState: "Open items" },
);

assert.deepEqual(
  calculateProjectCloseoutReadiness({
    closeoutStarted: false,
    finalPaymentRecorded: false,
    customerApprovalRecorded: false,
    requiredDocumentsCompleted: false,
    permitClosureCompleted: false,
    crewRemovalCompleted: false,
    equipmentReturnCompleted: false,
    openPunchItems: Number.NaN,
  }),
  { score: 0, status: "Not started", checklistCompleted: 0, checklistTotal: 6, punchState: "Clear" },
);

console.log("project closeout readiness tests passed");

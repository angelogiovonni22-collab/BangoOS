import assert from "node:assert/strict";
import { calculateProjectCloseoutReadiness } from "./project-closeout-readiness";

const empty = {
  finalPaymentRecorded: false,
  customerApprovalRecorded: false,
  requiredDocumentsCompleted: false,
  permitClosureCompleted: false,
  crewRemovalCompleted: false,
  equipmentReturnCompleted: false,
  openPunchItems: 0,
  pendingInspections: 0,
  openPermits: 0,
};

assert.deepEqual(
  calculateProjectCloseoutReadiness({ closeoutStarted: false, ...empty }),
  { score: 0, status: "Not started", checklistCompleted: 0, checklistTotal: 6, nextAction: "start_closeout" },
);

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
    pendingInspections: 0,
    openPermits: 0,
  }),
  { score: 100, status: "Ready", checklistCompleted: 6, checklistTotal: 6, nextAction: "complete" },
);

const blocked = calculateProjectCloseoutReadiness({
  closeoutStarted: true,
  finalPaymentRecorded: false,
  customerApprovalRecorded: false,
  requiredDocumentsCompleted: false,
  permitClosureCompleted: false,
  crewRemovalCompleted: false,
  equipmentReturnCompleted: false,
  openPunchItems: 2,
  pendingInspections: 1,
  openPermits: 1,
});
assert.equal(blocked.status, "Blocked");
assert.equal(blocked.nextAction, "punch_items");
assert.equal(blocked.score, 0);

assert.equal(
  calculateProjectCloseoutReadiness({
    closeoutStarted: true,
    finalPaymentRecorded: false,
    customerApprovalRecorded: false,
    requiredDocumentsCompleted: true,
    permitClosureCompleted: true,
    crewRemovalCompleted: true,
    equipmentReturnCompleted: true,
    openPunchItems: 0,
    pendingInspections: 0,
    openPermits: 0,
  }).nextAction,
  "final_payment",
);

assert.equal(
  calculateProjectCloseoutReadiness({
    closeoutStarted: true,
    finalPaymentRecorded: true,
    customerApprovalRecorded: true,
    requiredDocumentsCompleted: true,
    permitClosureCompleted: true,
    crewRemovalCompleted: true,
    equipmentReturnCompleted: true,
    openPunchItems: Number.NaN,
    pendingInspections: -2,
    openPermits: Number.POSITIVE_INFINITY,
  }).status,
  "Ready",
);

console.log("project closeout readiness tests passed");

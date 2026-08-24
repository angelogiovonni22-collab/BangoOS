import assert from "node:assert/strict";
import { calculateProjectCloseoutReadiness } from "./project-closeout-readiness";

assert.deepEqual(
  calculateProjectCloseoutReadiness({
    closeoutStarted: false,
    closeoutReady: false,
    projectProgress: 40,
    openPunchItems: 0,
    pendingInspections: 0,
    openPermits: 0,
  }),
  { score: 0, status: "Not started", nextAction: "start_closeout" },
);

assert.deepEqual(
  calculateProjectCloseoutReadiness({
    closeoutStarted: true,
    closeoutReady: true,
    projectProgress: 100,
    openPunchItems: 0,
    pendingInspections: 0,
    openPermits: 0,
  }),
  { score: 100, status: "Ready", nextAction: "complete" },
);

const blocked = calculateProjectCloseoutReadiness({
  closeoutStarted: true,
  closeoutReady: false,
  projectProgress: 85,
  openPunchItems: 2,
  pendingInspections: 1,
  openPermits: 1,
});
assert.equal(blocked.status, "Blocked");
assert.equal(blocked.nextAction, "punch_items");
assert.equal(blocked.score, 34);

assert.equal(
  calculateProjectCloseoutReadiness({
    closeoutStarted: true,
    closeoutReady: false,
    projectProgress: 100,
    openPunchItems: 0,
    pendingInspections: 0,
    openPermits: 0,
  }).nextAction,
  "closeout_checklist",
);

assert.equal(
  calculateProjectCloseoutReadiness({
    closeoutStarted: true,
    closeoutReady: false,
    projectProgress: 70,
    openPunchItems: 0,
    pendingInspections: 0,
    openPermits: 0,
  }).nextAction,
  "finish_work",
);

assert.equal(
  calculateProjectCloseoutReadiness({
    closeoutStarted: true,
    closeoutReady: true,
    projectProgress: Number.POSITIVE_INFINITY,
    openPunchItems: Number.NaN,
    pendingInspections: -2,
    openPermits: Number.POSITIVE_INFINITY,
  }).status,
  "In progress",
);

console.log("project closeout readiness tests passed");

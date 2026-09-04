import assert from "node:assert/strict";
import { scoreReconciliationCandidate } from "./service";

const exact = scoreReconciliationCandidate(
  { transactionDate: "2026-09-04", amount: 1250, description: "ACH PAYMENT INV-1042" },
  { date: "2026-09-04", amount: 1250, label: "INV-1042" },
);
assert.ok(exact >= 0.9, `expected strong exact match, received ${exact}`);

const nearby = scoreReconciliationCandidate(
  { transactionDate: "2026-09-06", amount: 500, description: "Vendor payment" },
  { date: "2026-09-04", amount: 500, label: "" },
);
assert.ok(nearby >= 0.7, `expected date-tolerant match, received ${nearby}`);

const wrongAmount = scoreReconciliationCandidate(
  { transactionDate: "2026-09-04", amount: 500, description: "Vendor payment" },
  { date: "2026-09-04", amount: 700, label: "Vendor" },
);
assert.equal(wrongAmount, 0);

const stale = scoreReconciliationCandidate(
  { transactionDate: "2026-09-20", amount: 500, description: "Vendor payment" },
  { date: "2026-09-04", amount: 500, label: "Vendor" },
);
assert.equal(stale, 0);

console.log("banking reconciliation contract tests passed");

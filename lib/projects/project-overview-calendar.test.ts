import assert from "node:assert/strict";
import { projectAssignmentsOnDay, projectCalendarDay, projectScheduleSummary } from "./project-overview-calendar";

const summary = (overrides = {}) => projectScheduleSummary({ targetDate: "2026-11-06", today: "2026-11-07", status: "in_progress", hasPlannedWork: true, hasOpenItems: false, ...overrides });
assert.deepEqual(summary(), { daysRemaining: -1, overdueDays: 1, health: "Overdue", detail: "1 day past target completion" });
assert.equal(summary({ hasPlannedWork: false }).health, "Overdue", "missing assignments must not hide a missed target");
assert.equal(summary({ today: "2026-11-06" }).health, "On Track", "date-only target remains current through the company day");
assert.equal(summary({ today: "2026-11-05" }).daysRemaining, 1);
assert.equal(summary({ status: "completed" }).overdueDays, 0);
assert.equal(summary({ status: "cancelled" }).health, "Cancelled");
assert.equal(summary({ today: null }).health, "Calendar unavailable");
assert.equal(summary({ targetDate: "2026-02-30" }).health, "Needs Setup");
assert.equal(summary({ targetDate: null }).health, "Needs Setup");
assert.equal(summary({ targetDate: "2026-11-08", hasOpenItems: true }).health, "Needs Attention");
assert.equal(summary({ today: "2026-11-01", targetDate: "2026-11-02" }).daysRemaining, 1, "DST day is one calendar day despite its 25 hours");

assert.equal(projectCalendarDay(new Date("2026-11-07T02:00:00Z"), "America/New_York"), "2026-11-06");
assert.equal(projectCalendarDay(new Date("2026-11-06T23:00:00Z"), "Pacific/Auckland"), "2026-11-07");
assert.equal(projectCalendarDay(new Date(), "invalid-zone"), null);

const assignment = { id: "yesterday", starts_at: "2026-11-07T02:00:00Z", ends_at: "2026-11-07T04:00:00Z", status: "confirmed" };
assert.equal(projectAssignmentsOnDay([assignment], "2026-11-07", "America/New_York").length, 0, "UTC date must not count yesterday's evening shift today");
assert.equal(projectAssignmentsOnDay([assignment], "2026-11-06", "America/New_York").length, 1);
const overnight = { ...assignment, ends_at: "2026-11-07T06:00:00Z" };
assert.equal(projectAssignmentsOnDay([overnight], "2026-11-07", "America/New_York").length, 1);
assert.equal(projectAssignmentsOnDay([{ ...assignment, ends_at: "2026-11-07T05:00:00Z" }], "2026-11-07", "America/New_York").length, 0, "midnight end excludes next day");
for (const status of ["completed", "cancelled", "canceled"]) assert.equal(projectAssignmentsOnDay([{ ...overnight, status }], "2026-11-07", "America/New_York").length, 0);
assert.equal(projectAssignmentsOnDay([overnight], "2026-11-07", null).length, 0);
assert.equal(projectAssignmentsOnDay([{ ...overnight, starts_at: "invalid" }], "2026-11-07", "America/New_York").length, 0);
console.log("Project overview calendar checks passed: overdue/current/future/closed dates, unavailable calendar, DST, both UTC offsets, overnight/midnight shifts and inactive assignments.");

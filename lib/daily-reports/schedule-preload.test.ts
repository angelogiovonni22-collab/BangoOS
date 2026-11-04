import assert from "node:assert/strict";
import { selectDailyReportAssignment } from "./schedule-preload";

const cancelled = { id: "cancelled", date: "2026-11-04", status: "cancelled" as const };
const previous = { id: "previous", date: "2026-11-03", status: "published" as const };
const active = { id: "active", date: "2026-11-04", status: "published" as const };
assert.equal(selectDailyReportAssignment([cancelled, previous, active], "2026-11-04"), active);
assert.equal(selectDailyReportAssignment([cancelled, previous], "2026-11-04"), null);
assert.equal(selectDailyReportAssignment([previous], "2026-11-04"), null);
assert.equal(selectDailyReportAssignment([], "2026-11-04"), null);
const completed = { ...active, status: "completed" as const };
assert.equal(selectDailyReportAssignment([completed], "2026-11-04"), completed);
console.log("Daily report scheduling preload regression: 5 passed");

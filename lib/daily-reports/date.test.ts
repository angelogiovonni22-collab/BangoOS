import assert from "node:assert/strict";
import { dailyReportDate, previousDailyReportDate } from "./date";

process.env.TZ = "America/New_York";
assert.equal(dailyReportDate(new Date("2026-10-06T00:30:00Z")), "2026-10-05");
assert.equal(dailyReportDate(new Date("2026-10-06T04:30:00Z")), "2026-10-06");
assert.equal(previousDailyReportDate(new Date("2026-03-09T00:30:00-04:00")), "2026-03-08");
assert.equal(previousDailyReportDate(new Date("2026-11-02T00:30:00-05:00")), "2026-11-01");
assert.equal(previousDailyReportDate(new Date("2027-01-01T00:30:00-05:00")), "2026-12-31");
process.env.TZ = "Asia/Tokyo";
assert.equal(dailyReportDate(new Date("2026-10-05T18:00:00Z")), "2026-10-06");
console.log("Daily Report calendar regression: 6 passed");

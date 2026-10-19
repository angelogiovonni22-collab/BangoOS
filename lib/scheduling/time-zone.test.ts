import assert from "node:assert/strict";
import { createScheduleWindow, moveScheduleWindow, resolveScheduleTimeZone, scheduleClock, scheduleInstant } from "./time-zone";

assert.equal(scheduleInstant("2026-10-20", "09:00", "America/New_York"), "2026-10-20T13:00:00.000Z");
assert.equal(scheduleInstant("2026-12-20", "09:00", "America/New_York"), "2026-12-20T14:00:00.000Z");
assert.equal(scheduleInstant("2026-10-20", "09:00", "UTC"), "2026-10-20T09:00:00.000Z");
assert.equal(scheduleInstant("2026-10-20", "09:00", "Asia/Kolkata"), "2026-10-20T03:30:00.000Z");
assert.equal(scheduleInstant("2026-10-20", "00:30", "Pacific/Auckland"), "2026-10-19T11:30:00.000Z");
for (const zone of ["America/New_York", "UTC", "Asia/Kolkata", "Pacific/Auckland"]) {
  const instant = scheduleInstant("2026-10-20", "09:00", zone);
  assert.deepEqual(scheduleClock(instant, zone), { date: "2026-10-20", time: "09:00" });
}
assert.throws(() => scheduleInstant("2026-03-08", "02:30", "America/New_York"), /does not exist/);
assert.throws(() => scheduleInstant("2026-11-01", "01:30", "America/New_York"), /occurs twice/);
assert.throws(() => scheduleInstant("2026-02-30", "09:00", "UTC"), /valid assignment/);
assert.throws(() => scheduleInstant("2026-10-20", "25:00", "UTC"), /valid assignment/);
assert.throws(() => resolveScheduleTimeZone("Invalid/Zone"), /company scheduling time zone is invalid/);
assert.equal(resolveScheduleTimeZone(" America/New_York "), "America/New_York");

const springNight = createScheduleWindow("2026-03-07", "23:00", "07:00", "America/New_York");
assert.equal((Date.parse(springNight.endsAt) - Date.parse(springNight.startsAt)) / 3_600_000, 7);
assert.deepEqual(scheduleClock(springNight.endsAt, "America/New_York"), { date: "2026-03-08", time: "07:00" });
const fallNight = createScheduleWindow("2026-10-31", "23:00", "07:00", "America/New_York");
assert.equal((Date.parse(fallNight.endsAt) - Date.parse(fallNight.startsAt)) / 3_600_000, 9);

const moved = moveScheduleWindow({ startsAt: "2026-10-30T13:00:00Z", endsAt: "2026-10-30T15:00:00Z", date: "2026-11-02", timeZone: "America/New_York" });
assert.deepEqual(moved, { startsAt: "2026-11-02T14:00:00.000Z", endsAt: "2026-11-02T16:00:00.000Z" });
const changedShift = moveScheduleWindow({ ...moved, shift: "night", timeZone: "America/New_York" });
assert.deepEqual(scheduleClock(changedShift.startsAt, "America/New_York"), { date: "2026-11-02", time: "23:00" });
assert.equal((Date.parse(changedShift.endsAt) - Date.parse(changedShift.startsAt)) / 3_600_000, 2);
const repeatedClock = { startsAt: "2026-11-01T05:30:00Z", endsAt: "2026-11-01T07:30:00Z" };
assert.deepEqual(moveScheduleWindow({ ...repeatedClock, timeZone: "America/New_York" }), repeatedClock, "resource-only moves preserve an existing unambiguous instant");
assert.deepEqual(moveScheduleWindow({ ...repeatedClock, endTime: "02:30", timeZone: "America/New_York" }), { startsAt: repeatedClock.startsAt, endsAt: "2026-11-01T07:30:00.000Z" });
console.log("Scheduling company time zone: clock round trips, non-hour offsets, date boundaries, DST gaps/repeats, overnight duration and moves passed.");

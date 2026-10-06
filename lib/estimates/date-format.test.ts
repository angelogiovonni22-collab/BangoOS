import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { formatEstimateDate } from "../estimates";

if (process.env.BOS_DATE_FIXTURE_ZONE) {
  const zone = process.env.BOS_DATE_FIXTURE_ZONE;
  assert.equal(formatEstimateDate("2026-10-05"), "Oct 5, 2026", `${zone}: calendar dates retain their written day`);
  assert.equal(formatEstimateDate("2026-10-06T01:30:00Z"), zone === "America/New_York" ? "Oct 5, 2026" : "Oct 6, 2026", `${zone}: timestamps display the local day`);
  assert.equal(formatEstimateDate("2026-03-08T04:30:00Z"), zone === "America/New_York" ? "Mar 7, 2026" : "Mar 8, 2026", `${zone}: timestamp near DST boundary`);
  assert.equal(formatEstimateDate("2026-03-08"), "Mar 8, 2026", `${zone}: date-only DST boundary`);
  assert.equal(formatEstimateDate(null, "en-US", "Missing"), "Missing");
  assert.equal(formatEstimateDate("not-a-date", "en-US", "Missing"), "Missing");
} else {
  for (const zone of ["America/New_York", "Asia/Tokyo", "UTC"]) {
    const result = spawnSync(process.execPath, [...process.execArgv, process.argv[1]], { env: { ...process.env, TZ: zone, BOS_DATE_FIXTURE_ZONE: zone }, encoding: "utf8" });
    assert.equal(result.status, 0, `${zone}: ${result.stderr || result.stdout}`);
  }
  console.log("Estimate date formatting: 18 timezone/DST/invalid-input fixtures passed.");
}

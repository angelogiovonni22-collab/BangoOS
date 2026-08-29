import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { canAccessPath } from "@/lib/access-control/permissions";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const internalSchedule = read("app/(app)/schedule/page.tsx");
const partnerSchedule = read("app/(app)/partner/schedule/page.tsx");
const partnerHome = read("app/(app)/partner/page.tsx");

assert.equal(canAccessPath("subcontractor", "/schedule"), false, "subcontractors must not access the internal Construction Dispatch Center");
assert.equal(canAccessPath("subcontractor", "/partner/schedule"), true, "subcontractors must be able to access their restricted schedule");
assert.equal(canAccessPath("owner", "/schedule"), true, "owners must retain internal scheduling access");

assert.match(internalSchedule, /redirect\("\/partner\/schedule"\)/);
assert.match(partnerSchedule, /My Assigned Work/);
assert.match(partnerSchedule, /get_my_trade_partner_jobs/);
assert.match(partnerSchedule, /Only your company/);
assert.match(partnerSchedule, /Internal employee staffing, other contractors, labor demand, dispatch analytics, and company-wide schedule conflicts are not shown here/);
assert.doesNotMatch(partnerSchedule, /Available Contractors or Vendors/);
assert.doesNotMatch(partnerSchedule, /Labor Demand by Trade/);
assert.doesNotMatch(partnerSchedule, /Schedule Health Score/);
assert.match(partnerHome, /href="\/partner\/schedule"/);
assert.match(partnerHome, />My Schedule</);

console.log("Trade Partner restricted schedule boundary contract passed.");

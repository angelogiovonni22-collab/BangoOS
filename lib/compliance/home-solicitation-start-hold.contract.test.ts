import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/migrations/20260814140000_home_solicitation_start_hold.sql", "utf8");
assert.match(sql, /assert_estimate_work_may_begin/, "start guard function must exist");
assert.match(sql, /CONTRACT_CANCELLED/, "cancelled contracts must block work");
assert.match(sql, /HOME_SOLICITATION_CANCELLATION_HOLD/, "active cancellation period must block work");
assert.match(sql, /current_date\s*<=\s*v_profile\.cancellation_deadline_date/, "hold must remain active through the cancellation deadline");
console.log("Home-solicitation work-start hold contract passed.");

import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/migrations/20260814141000_home_solicitation_auto_release.sql", "utf8");
assert.match(sql, /cancelled_at is not null[\s\S]*return false/i, "cancelled contracts must never auto-release");
assert.match(sql, /current_date\s*>\s*v_profile\.cancellation_deadline_date/, "release must occur only after the deadline");
assert.match(sql, /work_released_at\s*=\s*now\(\)/, "release timestamp must be persisted");
console.log("Home-solicitation hold release contract passed.");

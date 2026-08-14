import fs from "node:fs";
import assert from "node:assert/strict";
const sql = fs.readFileSync("supabase/migrations/20260814142000_home_solicitation_events.sql", "utf8");
for (const event of ["notice_delivered","oral_disclosure_confirmed","contract_signed","cancellation_received","work_hold_created","work_hold_released"]) {
  assert.match(sql, new RegExp(event), `event schema must support ${event}`);
}
assert.match(sql, /for select[\s\S]*authenticated/i, "company members must be able to read the audit trail");
console.log("Home-solicitation event audit contract passed.");

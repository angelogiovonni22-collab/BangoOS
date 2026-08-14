import fs from "node:fs";
import assert from "node:assert/strict";

const sendRoute = fs.readFileSync("app/api/estimates/[id]/contract/route.ts", "utf8");
const publicRoute = fs.readFileSync("app/api/contracts/estimate/[token]/route.ts", "utf8");
const cancelRoute = fs.readFileSync("app/api/contracts/estimate/[token]/cancel/route.ts", "utf8");
const publicPage = fs.readFileSync("app/contracts/estimate/[token]/page.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260814133000_estimate_home_solicitation_compliance.sql", "utf8");

assert.match(sendRoute, /home.?solicitation/i, "send route must enforce home-solicitation readiness");
assert.match(publicRoute, /cancellation/i, "public contract route must expose cancellation information");
assert.match(cancelRoute, /cancel/i, "public cancellation endpoint must exist");
assert.match(publicPage, /cancel/i, "public contract page must present cancellation controls or notice");
assert.match(migration, /work_start_hold/i, "schema must preserve a work-start hold");
assert.match(migration, /cancelled_at/i, "schema must preserve cancellation state");

console.log("Ohio home-solicitation integration contract passed.");

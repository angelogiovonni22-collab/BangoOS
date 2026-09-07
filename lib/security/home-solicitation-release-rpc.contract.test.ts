import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260907043000_home_solicitation_release_rpc_hardening.sql"),
  "utf8",
);

assert.match(
  sql,
  /revoke all on function public\.release_expired_home_solicitation_hold\(uuid, uuid\)[\s\S]*from public, anon, authenticated/i,
  "automatic home-solicitation hold release must not remain callable by signed-in browsers",
);
assert.match(
  sql,
  /grant execute on function public\.release_expired_home_solicitation_hold\(uuid, uuid\)[\s\S]*to service_role/i,
  "trusted server workflows must retain automatic hold release",
);

console.log("Home-solicitation release RPC contract passed.");

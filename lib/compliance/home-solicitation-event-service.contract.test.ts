import fs from "node:fs";
import assert from "node:assert/strict";
const service = fs.readFileSync("lib/compliance/home-solicitation-events-service.ts", "utf8");
assert.match(service, /estimate_home_solicitation_events/);
assert.match(service, /event_type/);
assert.match(service, /actor_type/);
assert.match(service, /metadata/);
console.log("Home-solicitation event writer contract passed.");

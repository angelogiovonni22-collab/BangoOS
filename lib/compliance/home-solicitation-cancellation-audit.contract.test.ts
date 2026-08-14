import fs from "node:fs";
import assert from "node:assert/strict";
const route = fs.readFileSync("app/api/contracts/estimate/[token]/cancel/route.ts", "utf8");
assert.match(route, /recordHomeSolicitationEvent/, "cancellation route must write the append-only audit trail");
assert.match(route, /eventType:\s*"cancellation_received"/, "cancellation route must record cancellation_received");
assert.match(route, /timely/, "audit metadata must preserve timeliness");
console.log("Home-solicitation cancellation audit wiring passed.");

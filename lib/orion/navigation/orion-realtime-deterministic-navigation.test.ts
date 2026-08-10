import assert from "node:assert/strict";
import { resolveRealtimeNavigationCommand } from "./realtime-navigation";

const cases: Array<[string, string]> = [
  ["open customers", "/customers"],
  ["Go to Projects.", "/projects"],
  ["show me schedule", "/schedule"],
  ["Hey Orion, open employees", "/employees"],
  ["Orion open crews please", "/crews"],
  ["open estimates", "/estimates"],
  ["show invoices", "/invoices"],
  ["navigate to settings", "/settings"],
  ["bring up equipment", "/equipment"],
  ["show calendar", "/schedule"],
];

for (const [utterance, expectedHref] of cases) {
  const resolved = resolveRealtimeNavigationCommand(utterance);
  assert.ok(resolved, `expected deterministic navigation for: ${utterance}`);
  assert.equal(resolved.deepLink, expectedHref, `wrong route for: ${utterance}`);
}

assert.equal(
  resolveRealtimeNavigationCommand("open John Smith project"),
  null,
  "entity-specific commands must not be collapsed into generic navigation",
);

assert.equal(
  resolveRealtimeNavigationCommand("what invoices are overdue"),
  null,
  "read/query requests must remain in Orion intelligence instead of navigating",
);

assert.equal(
  resolveRealtimeNavigationCommand("create a new estimate"),
  null,
  "visible create-estimate workflow must remain operator-driven",
);

console.log("Orion Realtime deterministic navigation tests passed.");

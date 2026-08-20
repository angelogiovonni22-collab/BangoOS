import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canUseOrion, isOrionConfigurableRole } from "./permissions";

assert.equal(canUseOrion("owner"), true, "Owner must always have Orion access.");
assert.equal(canUseOrion("administrator"), true, "Administrator must always have Orion access.");

for (const role of ["operations_manager", "project_manager", "estimator", "superintendent", "office_manager", "accountant"] as const) {
  assert.equal(isOrionConfigurableRole(role), true, `${role} should be Orion-configurable.`);
  assert.equal(canUseOrion(role), false, `${role} should not receive Orion by default.`);
  assert.equal(canUseOrion(role, { "orion.use": true }), true, `${role} should receive Orion only when explicitly granted.`);
  assert.equal(canUseOrion(role, { "orion.use": false }), false, `${role} Orion denial override must remain denied.`);
}

for (const role of ["foreman", "employee", "subcontractor", "customer"] as const) {
  assert.equal(isOrionConfigurableRole(role), false, `${role} must never be Orion-configurable.`);
  assert.equal(canUseOrion(role, { "orion.use": true }), false, `${role} must remain blocked even if a forged override requests Orion.`);
}

const layout = readFileSync("app/(app)/layout.tsx", "utf8");
assert.match(layout, /select\("permission_overrides"\)/, "Authenticated app layout must resolve the active membership's Orion override.");
assert.match(layout, /canUseOrion\(workspace\.context\.role, permissionOverrides\)/, "App shell authorization must use the canonical Orion permission model.");

const appShell = readFileSync("app/(app)/app-shell.tsx", "utf8");
assert.match(appShell, /orionEnabled \? \(\s*<GlobalOrionVoiceProvider>/, "Orion voice providers must mount only for authorized sessions.");
assert.match(appShell, /\{orionEnabled \? <PersistentOrion onOpenCommandCenter=/, "Persistent Orion must not render for unauthorized sessions.");
assert.match(appShell, /if \(!orionEnabled\) return;/, "Global Orion keyboard shortcut must be disabled for unauthorized sessions.");
assert.match(appShell, /\{orionEnabled \? <OrionCommandCenterOverlay/, "Orion Command Center must not render for unauthorized sessions.");

const middleware = readFileSync("middleware.ts", "utf8");
assert.match(middleware, /pathname\.startsWith\("\/api\/orion\/"\)/, "All Orion API routes must pass through the privileged-access middleware boundary.");
assert.match(middleware, /canUseOrion\(membership\.role, overrides\)/, "Middleware must enforce the same canonical Orion permission model.");
assert.match(middleware, /statusCategory: "orion_access_denied"/, "Unauthorized Orion API calls must return an explicit access-denied category.");

const accessControlRoute = readFileSync("app/api/settings/access-control/route.ts", "utf8");
assert.match(accessControlRoute, /if \(!isOrionConfigurableRole\(body\.role\)\)/, "Access Control API must reject persistence of Orion grants for ineligible roles.");
assert.match(accessControlRoute, /delete overrides\["orion\.use"\]/, "Ineligible Orion grants must be stripped server-side.");

console.log("Orion privileged access contract passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validatePasswordStrength } from "./password-breach";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

assert.deepEqual(validatePasswordStrength("Short1!"), { ok: false, reason: "length" });
assert.deepEqual(validatePasswordStrength("alllowercase123!"), { ok: false, reason: "complexity" });
assert.deepEqual(validatePasswordStrength("StrongPassword123!"), { ok: true });

const policy = read("lib/security/password-breach.ts");
assert.match(policy, /createHash\("sha1"\)/, "breach screening must hash passwords before HIBP lookup");
assert.match(policy, /slice\(0, 5\)/, "only the five-character hash prefix may be sent to HIBP");
assert.match(policy, /Add-Padding/, "HIBP range requests should request padded responses");
assert.match(policy, /HIBP_TIMEOUT_MS = 5_000/, "external password screening must have a bounded timeout");
assert.doesNotMatch(policy, /console\./, "password screening must not log password material");

const route = read("app/api/security/password-check/route.ts");
assert.match(route, /Cache-Control.*no-store/s, "password check responses must not be cached");
assert.match(route, /status: 503/, "breach-service outages must fail closed");

for (const file of ["app/signup/page.tsx", "app/(app)/partner/welcome/page.tsx"]) {
  const source = read(file);
  assert.match(source, /\/api\/security\/password-check/, `${file} must screen passwords before account creation or update`);
}

console.log("Password breach compensating control contract passed.");

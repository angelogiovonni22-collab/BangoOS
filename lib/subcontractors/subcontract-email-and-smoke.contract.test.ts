import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const smoke = readFileSync(".github/workflows/production-smoke.yml", "utf8");
const route = readFileSync("app/api/projects/[id]/subcontractors/[assignmentId]/agreement/route.ts", "utf8");
const email = readFileSync("lib/subcontractors/branded-subcontract-email.ts", "utf8");

test("production smoke accepts relative or absolute Next.js redirect locations", () => {
  assert.match(smoke, /location: \(https:\/\/bango-os\\\.vercel\\\.app\)\?\/app-entry/);
  assert.match(smoke, /location: \(https:\/\/bango-os\\\.vercel\\\.app\)\?\/login/);
  assert.doesNotMatch(smoke, /write-out '%\{redirect_url\}'/);
});

test("subcontract agreements use branded BOS email presentation", () => {
  assert.match(route, /renderBrandedSubcontractEmail/);
  assert.match(email, /Review &amp; sign your subcontract/);
  assert.match(email, /Subcontract amount/);
  assert.match(email, /Sent securely by/);
  assert.match(email, /Do not forward it/);
});

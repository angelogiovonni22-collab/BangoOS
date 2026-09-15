import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/blueprints/[versionId]/engine-source-backed-shortrun-simulation/route.ts", "utf8");
const summaryRoute = readFileSync("app/api/blueprints/[versionId]/engine-source-family-audit-summary/route.ts", "utf8");

assert.match(route, /searchParams\.get\("familyIsolationId"\)/, "short-run route must gate isolated family replay behind an explicit query parameter");
assert.match(route, /if \(familyIsolationId\)/, "isolated family replay must be opt-in");
assert.match(route, /targetRepresentativePairIds: \[familyIsolationId\]/, "isolated replay must target exactly one requested family");
assert.doesNotMatch(route, /targeted\.targetFamilyIds\.map\(/, "route must not replay every short-run family in one request");
assert.match(route, /simulation = summarizeSelection\(targeted\)/, "default short-run diagnostic must preserve its existing aggregate simulation");
assert.match(summaryRoute, /targetUrl\.searchParams\.set\("familyIsolationId", familyIsolationId\)/, "compact authenticated summary must forward the requested isolated family");

console.log("source-backed short-run family isolation route contract passed");

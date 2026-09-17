import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/blueprints/[versionId]/engine-targeted-dedupe-collision-simulation/route.ts", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");

assert.match(route, /export const maxDuration = 120;/, "isolated de-duplication replay must have enough server runtime to complete the read-only A4 diagnostic");
assert.match(route, /searchParams\.get\("familyIsolationId"\)/, "targeted de-duplication route must require an explicit family isolation parameter for isolated replay");
assert.match(route, /affectedFamilyIds\.includes\(familyIsolationId\)/, "isolated replay must reject families without a proven de-duplication collision");
assert.match(route, /member\.representativePairId === familyIsolationId/, "isolated replay must restrict collision bands to the requested source family");
assert.match(route, /targetedCollisionMembers\.reduce/, "collision-face reporting must describe only the isolated family when requested");
assert.match(nextConfig, /"\/api\/blueprints\/\*\/engine-targeted-dedupe-collision-simulation"[^\n]+pdf\.worker\.mjs/, "Production tracing must include the pdfjs worker required by the isolated de-duplication route");
assert.match(route, /writesPerformed: false/, "isolated replay must remain read-only");
assert.match(route, /canonicalGeometryChanged: false/, "isolated replay must not modify canonical geometry");
assert.match(route, /generated3d: false/, "isolated replay must not generate 3D output");

console.log("Blueprint targeted de-duplication family isolation route contract passed.");
